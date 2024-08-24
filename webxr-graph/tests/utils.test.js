// utils.test.js

import { updateStatus } from '../public/js/utils';
import { addMessageToChat } from '../public/js/chatManager';

jest.mock('../public/js/chatManager', () => ({
  addMessageToChat: jest.fn(),
}));

describe('utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
  });

  test('updateStatus should call addMessageToChat and log to console', () => {
    const testMessage = 'Test status message';
    updateStatus(testMessage);

    expect(addMessageToChat).toHaveBeenCalledWith('System', `Status: ${testMessage}`);
    expect(console.log).toHaveBeenCalledWith(`Status: ${testMessage}`);
  });
});
