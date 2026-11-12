package com.brindix.common;

import com.brindix.platform.PlatformUser;
import com.brindix.platform.PlatformUserRepository;
import com.brindix.platform.VenueStarter;
import com.brindix.staff.Role;
import com.brindix.staff.StaffService;
import com.brindix.venue.VenueRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Primer arranque: crea el súper administrador de la plataforma y (opcional) el bar "demo"
 * con carta de ejemplo, un administrador y un mesero. Se apaga con BRINDIX_SEED=false.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final AppProperties props;
    private final PlatformUserRepository platformUsers;
    private final VenueRepository venues;
    private final VenueStarter starter;
    private final StaffService staff;
    private final PasswordEncoder encoder;

    public DataSeeder(AppProperties props, PlatformUserRepository platformUsers, VenueRepository venues,
                      VenueStarter starter, StaffService staff, PasswordEncoder encoder) {
        this.props = props;
        this.platformUsers = platformUsers;
        this.venues = venues;
        this.starter = starter;
        this.staff = staff;
        this.encoder = encoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        AppProperties.Seed seed = props.seed();
        if (!seed.enabled()) return;
        if (platformUsers.count() == 0) {
            PlatformUser u = new PlatformUser();
            u.setName("Brindix");
            u.setUsername(seed.superUsername().toLowerCase());
            u.setPasswordHash(encoder.encode(seed.superPassword()));
            platformUsers.save(u);
            log.info("Súper administrador creado: {} (entra en /plataforma)", u.getUsername());
        }
        if (seed.demoVenue() && !venues.existsBySlug("demo")) {
            var v = starter.create("Brindix Demo Bar", "demo", "Administrador", "admin", seed.adminPassword(), true);
            staff.newUser(v.getId(), "Mesero de prueba", "mesero", seed.waiterPassword(), Role.WAITER);
            log.info("Bar de demostración creado en /demo (admin / mesero).");
        }
    }
}
