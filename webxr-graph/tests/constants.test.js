// constants.test.js

import { CONSTANTS } from '../public/js/constants';

describe('CONSTANTS', () => {
  test('should have the correct properties', () => {
    expect(CONSTANTS).toHaveProperty('NODE_BASE_SIZE');
    expect(CONSTANTS).toHaveProperty('NODE_SIZE_EXPONENT');
    expect(CONSTANTS).toHaveProperty('MAX_FILE_SIZE');
    expect(CONSTANTS).toHaveProperty('MAX_HYPERLINK_COUNT');
    expect(CONSTANTS).toHaveProperty('MAX_EDGE_WEIGHT');
    expect(CONSTANTS).toHaveProperty('TEXT_VISIBILITY_THRESHOLD');
    expect(CONSTANTS).toHaveProperty('REPULSION_STRENGTH');
    expect(CONSTANTS).toHaveProperty('ATTRACTION_STRENGTH');
    expect(CONSTANTS).toHaveProperty('MAX_SPEED');
    expect(CONSTANTS).toHaveProperty('DAMPING');
    expect(CONSTANTS).toHaveProperty('CENTERING_FORCE');
    expect(CONSTANTS).toHaveProperty('EDGE_DISTANCE');
    expect(CONSTANTS).toHaveProperty('WS_RECONNECT_INTERVAL');
    expect(CONSTANTS).toHaveProperty('DOUBLE_CLICK_DELAY');
  });

  test('should have the correct types for each property', () => {
    expect(typeof CONSTANTS.NODE_BASE_SIZE).toBe('number');
    expect(typeof CONSTANTS.NODE_SIZE_EXPONENT).toBe('number');
    expect(typeof CONSTANTS.MAX_FILE_SIZE).toBe('number');
    expect(typeof CONSTANTS.MAX_HYPERLINK_COUNT).toBe('number');
    expect(typeof CONSTANTS.MAX_EDGE_WEIGHT).toBe('number');
    expect(typeof CONSTANTS.TEXT_VISIBILITY_THRESHOLD).toBe('number');
    expect(typeof CONSTANTS.REPULSION_STRENGTH).toBe('number');
    expect(typeof CONSTANTS.ATTRACTION_STRENGTH).toBe('number');
    expect(typeof CONSTANTS.MAX_SPEED).toBe('number');
    expect(typeof CONSTANTS.DAMPING).toBe('number');
    expect(typeof CONSTANTS.CENTERING_FORCE).toBe('number');
    expect(typeof CONSTANTS.EDGE_DISTANCE).toBe('number');
    expect(typeof CONSTANTS.WS_RECONNECT_INTERVAL).toBe('number');
    expect(typeof CONSTANTS.DOUBLE_CLICK_DELAY).toBe('number');
  });
});
