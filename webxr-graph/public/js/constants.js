/**
 * constants.js
 * Defines constants used throughout the application.
 */

export const CONSTANTS = {
    // Graph visualization constants
    NODE_BASE_SIZE: 1,
    NODE_SIZE_EXPONENT: 0.5,
    MAX_FILE_SIZE: 1000000, // 1 MB
    MAX_HYPERLINK_COUNT: 100,
    MAX_EDGE_WEIGHT: 10,
    TEXT_VISIBILITY_THRESHOLD: 50,

    // Simulation constants
    REPULSION_STRENGTH: 60.0,
    ATTRACTION_STRENGTH: 0.15,
    MAX_SPEED: 12.0,
    DAMPING: 0.98,
    CENTERING_FORCE: 0.005,
    EDGE_DISTANCE: 5.0,

    // WebSocket constants
    WS_RECONNECT_INTERVAL: 5000,

    // UI constants
    DOUBLE_CLICK_DELAY: 300,

    // Add any other constants used across the application
};
