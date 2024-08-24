// userInterface.test.js

import { setupKeyboardControls } from '../public/js/userInterface';

describe('userInterface', () => {
  let mockState;
  let addEventListenerSpy;

  beforeEach(() => {
    mockState = {
      graphSimulation: {
        reset: jest.fn(),
      },
    };
    addEventListenerSpy = jest.spyOn(document, 'addEventListener');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('setupKeyboardControls should add a keydown event listener', () => {
    setupKeyboardControls(mockState);
    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  test('pressing "r" should reset the simulation', () => {
    setupKeyboardControls(mockState);
    const keydownEvent = new KeyboardEvent('keydown', { key: 'r' });
    document.dispatchEvent(keydownEvent);
    expect(mockState.graphSimulation.reset).toHaveBeenCalled();
  });

  test('pressing "c" should not throw an error', () => {
    setupKeyboardControls(mockState);
    const keydownEvent = new KeyboardEvent('keydown', { key: 'c' });
    expect(() => {
      document.dispatchEvent(keydownEvent);
    }).not.toThrow();
  });
});
