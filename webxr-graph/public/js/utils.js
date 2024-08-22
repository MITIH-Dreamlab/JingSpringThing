import { addMessageToChat } from './chatManager.js';

export function updateStatus(message) {
    addMessageToChat('System', `Status: ${message}`);
    console.log(`Status: ${message}`);
}
