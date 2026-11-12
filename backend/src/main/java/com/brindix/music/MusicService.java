package com.brindix.music;

import com.brindix.common.ApiException;
import com.brindix.security.StaffPrincipal;
import com.brindix.tables.BarTable;
import com.brindix.tables.BarTableRepository;
import com.brindix.tables.TableService;
import com.brindix.venue.Venue;
import com.brindix.venue.VenueService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * La cola de Brindix es la que manda: orden, prioridades y lo que se quita se decide aquí.
 * - MANUAL: el administrador pone la música y pulsa «Siguiente».
 * - YOUTUBE: la pantalla del bar reproduce la canción actual y avisa al terminar.
 * - SPOTIFY: la siguiente se envía al reproductor del bar cuando la actual está por terminar.
 */
@Service
public class MusicService {

    private static final Logger log = LoggerFactory.getLogger(MusicService.class);
    private static final List<SongStatus> ACTIVE = List.of(SongStatus.PENDING, SongStatus.QUEUED);
    private static final int PUSH_BEFORE_END_MS = 25_000;

    private final SongRequestRepository songs;
    private final BarTableRepository tables;
    private final TableService tableService;
    private final VenueService venues;
    private final SpotifyClient spotify;
    private final SpotifyAccountService accounts;
    private final YouTubeClient youtube;

    /** Lo último que reportó Spotify por bar (la pantalla lo lee sin llamar a Spotify). */
    private final Map<Long, MusicDtos.NowPlaying> spotifyNow = new ConcurrentHashMap<>();
    /** Reproductor de la pantalla del TV de cada bar (Spotify Web Playback): id del dispositivo y cuándo se vio. */
    private final Map<Long, Object[]> screenDevices = new ConcurrentHashMap<>();

    public MusicService(SongRequestRepository songs, BarTableRepository tables, TableService tableService, VenueService venues,
                        SpotifyClient spotify, SpotifyAccountService accounts, YouTubeClient youtube) {
        this.songs = songs;
        this.tables = tables;
        this.tableService = tableService;
        this.venues = venues;
        this.spotify = spotify;
        this.accounts = accounts;
        this.youtube = youtube;
    }

    // ---------- Lectura ----------

    @Transactional(readOnly = true)
    public MusicDtos.QueueView queue(Venue venue, boolean includePending) {
        List<SongRequest> list = songs.findByVenueIdAndStatusInOrderByPositionAscIdAsc(venue.getId(),
                List.of(SongStatus.PENDING, SongStatus.QUEUED, SongStatus.PLAYING));
        Map<Long, String> tableNames = tableNames(list);
        SongRequest playing = list.stream().filter(s -> s.getStatus() == SongStatus.PLAYING).findFirst().orElse(null);
        List<MusicDtos.SongView> upNext = list.stream().filter(s -> s.getStatus() == SongStatus.QUEUED).map(s -> view(s, tableNames)).toList();
        List<MusicDtos.SongView> pending = includePending
                ? list.stream().filter(s -> s.getStatus() == SongStatus.PENDING).map(s -> view(s, tableNames)).toList() : List.of();
        return new MusicDtos.QueueView(venue.getMusicProvider(), nowPlaying(venue, playing, tableNames), upNext, pending,
                venue.spotifyConnected(), searchEnabled(venue));
    }

    @Transactional(readOnly = true)
    public List<MusicDtos.SongView> history(Long venueId, int hours) {
        List<SongRequest> list = songs.recentlyPlayed(venueId, Instant.now().minus(Math.max(1, hours), ChronoUnit.HOURS));
        Map<Long, String> names = tableNames(list);
        return list.stream().map(s -> view(s, names)).toList();
    }

    public List<MusicDtos.Track> search(Venue venue, String q) {
        if (q == null || q.trim().length() < 2) return List.of();
        return switch (venue.getMusicProvider()) {
            case SPOTIFY -> {
                SpotifyClient.Credentials c = accounts.credentials(venue);
                if (c == null) yield List.of();
                String token = null;
                try {
                    token = accounts.accessToken(venue.getId());
                } catch (ApiException e) {
                    log.warn("Spotify sin token de usuario, se busca con token de aplicación: {}", e.getMessage());
                }
                yield spotify.search(c, token, q, 12);
            }
            case YOUTUBE -> youtube.search(venues.youtubeKey(venue), q);
            case MANUAL -> List.of();
        };
    }

    // ---------- Pedidos ----------

    @Transactional
    public MusicDtos.SongView clientRequest(String slug, String code, MusicDtos.SongInput in) {
        Venue venue = venues.bySlug(slug);
        BarTable table = tableService.byCode(venue.getId(), code);
        if (!venue.isMusicEnabled()) throw ApiException.forbidden("Por ahora la música la pone el bar");
        if (searchEnabled(venue) && (in.ref() == null || in.ref().isBlank())) {
            throw ApiException.badRequest("Elige la canción de la lista de resultados");
        }
        long mine = songs.countByTableIdAndStatusIn(table.getId(), ACTIVE);
        if (mine >= venue.getMaxSongsPerTable()) {
            throw ApiException.tooMany("Tu mesa ya tiene " + mine + " canciones en la lista. Cuando suenen podrás pedir más.");
        }
        rejectDuplicate(venue.getId(), in);
        SongRequest s = fromInput(venue, in);
        s.setTableId(table.getId());
        s.setStatus(venue.isSongApproval() ? SongStatus.PENDING : SongStatus.QUEUED);
        s.setPosition(songs.maxPosition(venue.getId()) + 1);
        return view(songs.save(s), Map.of(table.getId(), table.getName()));
    }

    @Transactional
    public MusicDtos.SongView adminAdd(StaffPrincipal me, MusicDtos.SongInput in, boolean playNext) {
        Venue venue = venues.get(me.venueId());
        rejectDuplicate(venue.getId(), in);
        SongRequest s = fromInput(venue, in);
        if (s.getRequestedBy() == null) s.setRequestedBy(me.name());
        s.setStatus(SongStatus.QUEUED);
        s.setPosition(playNext ? songs.minQueuedPosition(venue.getId()) - 1 : songs.maxPosition(venue.getId()) + 1);
        s.setPinned(playNext);
        return view(songs.save(s), Map.of());
    }

    // ---------- Control del administrador ----------

    @Transactional
    public void approve(Long venueId, Long id) {
        SongRequest s = owned(venueId, id);
        if (s.getStatus() != SongStatus.PENDING) throw ApiException.conflict("Esa canción ya fue revisada");
        s.setStatus(SongStatus.QUEUED);
        s.setPosition(songs.maxPosition(venueId) + 1);
    }

    @Transactional
    public void reject(Long venueId, Long id) {
        SongRequest s = owned(venueId, id);
        if (s.getStatus() != SongStatus.PENDING && s.getStatus() != SongStatus.QUEUED) {
            throw ApiException.conflict("Esa canción ya no está en la lista");
        }
        s.setStatus(SongStatus.REJECTED);
        s.setFinishedAt(Instant.now());
    }

    @Transactional
    public void prioritize(Long venueId, Long id) {
        SongRequest s = queued(venueId, id);
        s.setPosition(songs.minQueuedPosition(venueId) - 1);
        s.setPinned(true);
    }

    @Transactional
    public void move(Long venueId, Long id, int direction) {
        List<SongRequest> list = songs.findByVenueIdAndStatusInOrderByPositionAscIdAsc(venueId, List.of(SongStatus.QUEUED));
        int i = indexOf(list, id);
        if (i < 0) throw ApiException.notFound("La canción no está en la cola");
        int j = i + (direction < 0 ? -1 : 1);
        if (j < 0 || j >= list.size()) return;
        for (int k = 0; k < list.size(); k++) list.get(k).setPosition((k + 1) * 10L);
        long a = list.get(i).getPosition();
        list.get(i).setPosition(list.get(j).getPosition());
        list.get(j).setPosition(a);
    }

    @Transactional
    public void togglePin(Long venueId, Long id) {
        SongRequest s = queued(venueId, id);
        s.setPinned(!s.isPinned());
    }

    /** Pasar a la siguiente de la cola. */
    @Transactional
    public void next(Long venueId) {
        Venue venue = venues.get(venueId);
        SongRequest next = songs.findFirstByVenueIdAndStatusOrderByPositionAscIdAsc(venueId, SongStatus.QUEUED).orElse(null);
        if (venue.getMusicProvider() == Venue.MusicProvider.SPOTIFY && venue.spotifyConnected()) {
            String token = accounts.requireToken(venueId);
            String device = screenDevice(venueId);
            if (device != null && next != null && next.getProvider() == Venue.MusicProvider.SPOTIFY && next.getTrackRef() != null) {
                spotify.playOn(token, device, next.getTrackRef());
                next.setSentToPlayer(true);
                return;
            }
            if (next != null && next.getProvider() == Venue.MusicProvider.SPOTIFY && next.getTrackRef() != null && !next.isSentToPlayer()) {
                spotify.addToQueue(token, next.getTrackRef());
                next.setSentToPlayer(true);
            }
            spotify.skip(token);
            return;
        }
        advance(venueId);
    }

    @Transactional
    public void stop(Long venueId) {
        finishPlaying(venueId);
    }

    // ---------- Pantalla del TV con Spotify (Web Playback SDK) ----------

    /** Token para el reproductor de la pantalla (solo con la llave del TV y si la cuenta dio permiso de reproducción). */
    public MusicDtos.ScreenSpotify screenSpotify(Venue venue) {
        if (venue.getMusicProvider() != Venue.MusicProvider.SPOTIFY || !venue.spotifyConnected()) {
            return new MusicDtos.ScreenSpotify(null, false, "Spotify no está conectado en Configuración → Música.");
        }
        String scopes = venue.getSpotifyScopes() == null ? "" : venue.getSpotifyScopes();
        if (!scopes.contains("streaming")) {
            return new MusicDtos.ScreenSpotify(null, false, "Para que suene en esta pantalla, vuelve a conectar Spotify en Configuración → Música (pide el permiso de reproducción).");
        }
        return new MusicDtos.ScreenSpotify(accounts.requireToken(venue.getId()), true, null);
    }

    /** La pantalla quedó lista como reproductor: se le pasa la reproducción y, si no suena nada, arranca la cola. */
    @Transactional
    public void screenReady(Venue venue, String deviceId) {
        String token = accounts.requireToken(venue.getId());
        screenDevices.put(venue.getId(), new Object[]{deviceId, Instant.now()});
        spotify.transfer(token, deviceId);
        Optional<SpotifyClient.PlayerState> state = spotify.currentlyPlaying(token);
        if (state.isEmpty() || !state.get().playing()) startOnScreen(venue.getId(), token);
    }

    /** Dispositivo de la pantalla visto en los últimos 10 minutos. */
    private String screenDevice(Long venueId) {
        Object[] d = screenDevices.get(venueId);
        if (d == null || ((Instant) d[1]).isBefore(Instant.now().minusSeconds(600))) return null;
        return (String) d[0];
    }

    public void screenAlive(Long venueId) {
        Object[] d = screenDevices.get(venueId);
        if (d != null) d[1] = Instant.now();
    }

    private void startOnScreen(Long venueId, String token) {
        String device = screenDevice(venueId);
        if (device == null) return;
        songs.findByVenueIdAndStatusInOrderByPositionAscIdAsc(venueId, List.of(SongStatus.QUEUED)).stream()
                .filter(s -> s.getProvider() == Venue.MusicProvider.SPOTIFY && s.getTrackRef() != null)
                .findFirst()
                .ifPresent(s -> {
                    try {
                        spotify.playOn(token, device, s.getTrackRef());
                        s.setSentToPlayer(true);
                        songs.save(s);
                    } catch (ApiException e) {
                        log.warn("No se pudo arrancar la música en la pantalla: {}", e.getMessage());
                    }
                });
    }

    // ---------- Pantalla con YouTube ----------

    /** Lo que debe reproducir la pantalla. Si no suena nada y hay cola, arranca la primera. */
    @Transactional
    public MusicDtos.PlayerCommand playerCommand(Venue venue) {
        if (venue.getMusicProvider() != Venue.MusicProvider.YOUTUBE) return null;
        SongRequest playing = songs.findByVenueIdAndStatus(venue.getId(), SongStatus.PLAYING).stream().findFirst().orElse(null);
        if (playing == null) {
            playing = songs.findByVenueIdAndStatusInOrderByPositionAscIdAsc(venue.getId(), List.of(SongStatus.QUEUED)).stream()
                    .filter(s -> s.getProvider() == Venue.MusicProvider.YOUTUBE && s.getTrackRef() != null).findFirst().orElse(null);
            if (playing == null) return null;
            playing.setStatus(SongStatus.PLAYING);
            playing.setStartedAt(Instant.now());
        }
        if (playing.getProvider() != Venue.MusicProvider.YOUTUBE || playing.getTrackRef() == null) return null;
        return new MusicDtos.PlayerCommand(playing.getId(), playing.getTrackRef(), playing.getTitle());
    }

    /** La pantalla avisa que el video terminó (o que no se pudo reproducir). */
    @Transactional
    public void playerEnded(Venue venue, Long songId) {
        SongRequest s = songs.findById(songId).filter(x -> x.getVenueId().equals(venue.getId())).orElse(null);
        if (s == null || s.getStatus() != SongStatus.PLAYING) return;
        advance(venue.getId());
    }

    // ---------- Sincronización con Spotify ----------

    @Transactional
    public void syncSpotify(Long venueId) {
        String token = accounts.accessToken(venueId);
        if (token == null) {
            spotifyNow.remove(venueId);
            return;
        }
        Optional<SpotifyClient.PlayerState> state = spotify.currentlyPlaying(token);
        if (state.isEmpty() || (!state.get().playing() && state.get().progressMs() == 0)) {
            spotifyNow.remove(venueId);
            startOnScreen(venueId, token);
            if (state.isEmpty()) return;
        }
        SpotifyClient.PlayerState ps = state.get();
        String uri = ps.track().ref();
        List<SongRequest> active = songs.findByVenueIdAndStatusInOrderByPositionAscIdAsc(venueId, List.of(SongStatus.QUEUED, SongStatus.PLAYING));
        for (SongRequest s : active) {
            if (s.getStatus() == SongStatus.PLAYING && !uri.equals(s.getTrackRef())) {
                s.setStatus(SongStatus.PLAYED);
                s.setFinishedAt(Instant.now());
            }
        }
        SongRequest current = active.stream().filter(s -> s.getStatus() == SongStatus.PLAYING && uri.equals(s.getTrackRef())).findFirst()
                .orElseGet(() -> active.stream().filter(s -> s.getStatus() == SongStatus.QUEUED && uri.equals(s.getTrackRef()))
                        .min(Comparator.comparing((SongRequest s) -> !s.isSentToPlayer()).thenComparingLong(SongRequest::getPosition))
                        .orElse(null));
        if (current != null && current.getStatus() == SongStatus.QUEUED) {
            current.setStatus(SongStatus.PLAYING);
            current.setStartedAt(Instant.now());
        }
        String tableName = current == null || current.getTableId() == null ? null
                : tables.findById(current.getTableId()).map(BarTable::getName).orElse(null);
        spotifyNow.put(venueId, new MusicDtos.NowPlaying(ps.track().title(), ps.track().artist(), ps.track().image(),
                ps.track().durationMs(), ps.progressMs(), ps.playing(), current == null ? null : current.getRequestedBy(),
                tableName, current != null, Instant.now()));
        int remaining = (ps.track().durationMs() == null ? 0 : ps.track().durationMs()) - ps.progressMs();
        boolean alreadySent = active.stream().anyMatch(s -> s.getStatus() == SongStatus.QUEUED && s.isSentToPlayer() && s != current);
        if (ps.playing() && remaining < PUSH_BEFORE_END_MS && !alreadySent) {
            active.stream()
                    .filter(s -> s.getStatus() == SongStatus.QUEUED && s != current && s.getProvider() == Venue.MusicProvider.SPOTIFY && s.getTrackRef() != null)
                    .findFirst()
                    .ifPresent(s -> {
                        spotify.addToQueue(token, s.getTrackRef());
                        s.setSentToPlayer(true);
                    });
        }
    }

    // ---------- Internos ----------

    private boolean searchEnabled(Venue v) {
        return switch (v.getMusicProvider()) {
            case SPOTIFY -> v.getSpotifyClientId() != null && v.getSpotifyClientSecret() != null;
            case YOUTUBE -> v.getYoutubeApiKey() != null;
            case MANUAL -> false;
        };
    }

    private void advance(Long venueId) {
        finishPlaying(venueId);
        songs.findFirstByVenueIdAndStatusOrderByPositionAscIdAsc(venueId, SongStatus.QUEUED).ifPresent(n -> {
            n.setStatus(SongStatus.PLAYING);
            n.setStartedAt(Instant.now());
        });
    }

    private MusicDtos.NowPlaying nowPlaying(Venue venue, SongRequest playing, Map<Long, String> tableNames) {
        if (venue.getMusicProvider() == Venue.MusicProvider.SPOTIFY && venue.spotifyConnected()) {
            return spotifyNow.get(venue.getId());
        }
        if (playing == null) return null;
        Integer progress = playing.getStartedAt() == null ? null
                : (int) Math.min(Integer.MAX_VALUE, Instant.now().toEpochMilli() - playing.getStartedAt().toEpochMilli());
        return new MusicDtos.NowPlaying(playing.getTitle(), playing.getArtist(), playing.getAlbumImage(), playing.getDurationMs(),
                progress, true, playing.getRequestedBy(), playing.getTableId() == null ? null : tableNames.get(playing.getTableId()),
                true, Instant.now());
    }

    private void finishPlaying(Long venueId) {
        for (SongRequest s : songs.findByVenueIdAndStatus(venueId, SongStatus.PLAYING)) {
            s.setStatus(SongStatus.PLAYED);
            s.setFinishedAt(Instant.now());
        }
    }

    private void rejectDuplicate(Long venueId, MusicDtos.SongInput in) {
        List<SongRequest> list = songs.findByVenueIdAndStatusInOrderByPositionAscIdAsc(venueId,
                List.of(SongStatus.PENDING, SongStatus.QUEUED, SongStatus.PLAYING));
        String key = norm(in.title()) + "|" + norm(in.artist());
        boolean dup = list.stream().anyMatch(s ->
                (in.ref() != null && !in.ref().isBlank() && in.ref().equals(s.getTrackRef()))
                        || key.equals(norm(s.getTitle()) + "|" + norm(s.getArtist())));
        if (dup) throw ApiException.conflict("Esa canción ya está en la lista");
    }

    private SongRequest fromInput(Venue venue, MusicDtos.SongInput in) {
        SongRequest s = new SongRequest();
        s.setVenueId(venue.getId());
        boolean hasRef = in.ref() != null && !in.ref().isBlank();
        s.setProvider(hasRef ? venue.getMusicProvider() : Venue.MusicProvider.MANUAL);
        s.setTrackRef(hasRef ? in.ref().trim() : null);
        s.setTitle(in.title().trim());
        s.setArtist(blank(in.artist()));
        s.setAlbumImage(blank(in.albumImage()));
        s.setDurationMs(in.durationMs());
        s.setRequestedBy(blank(in.requestedBy()));
        return s;
    }

    private SongRequest owned(Long venueId, Long id) {
        return songs.findById(id).filter(s -> s.getVenueId().equals(venueId))
                .orElseThrow(() -> ApiException.notFound("Canción no encontrada"));
    }

    private SongRequest queued(Long venueId, Long id) {
        SongRequest s = owned(venueId, id);
        if (s.getStatus() != SongStatus.QUEUED) throw ApiException.conflict("La canción no está en la cola");
        return s;
    }

    private static int indexOf(List<SongRequest> list, Long id) {
        for (int i = 0; i < list.size(); i++) if (list.get(i).getId().equals(id)) return i;
        return -1;
    }

    private Map<Long, String> tableNames(List<SongRequest> list) {
        Set<Long> ids = list.stream().map(SongRequest::getTableId).filter(Objects::nonNull).collect(Collectors.toSet());
        return ids.isEmpty() ? new HashMap<>() : tables.findAllById(ids).stream().collect(Collectors.toMap(BarTable::getId, BarTable::getName));
    }

    private static MusicDtos.SongView view(SongRequest s, Map<Long, String> tableNames) {
        return new MusicDtos.SongView(s.getId(), s.getProvider(), s.getTrackRef(), s.getTitle(), s.getArtist(), s.getAlbumImage(),
                s.getDurationMs(), s.getRequestedBy(), s.getTableId() == null ? null : tableNames.get(s.getTableId()),
                s.getStatus(), s.isPinned(), s.isSentToPlayer(), s.getCreatedAt(), s.getStartedAt());
    }

    private static String norm(String s) {
        return s == null ? "" : java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
