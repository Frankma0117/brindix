package com.brindix.music;

public enum SongStatus {
    /** Pedida por un cliente, esperando aprobación (si el bar la exige). */
    PENDING,
    /** En la cola. */
    QUEUED,
    /** Sonando ahora. */
    PLAYING,
    PLAYED,
    REJECTED
}
