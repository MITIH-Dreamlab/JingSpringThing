// ragflow_api.js

const RAGFLOW_BASE_URL = "https://demo.ragflow.io/v1/";

// We'll need to set this value another way in the browser context
let API_KEY = '';

export function setApiKey(key) {
    API_KEY = key;
}

export async function createConversation(user_id) {
    if (!API_KEY) {
        throw new Error('API key not set. Call setApiKey() first.');
    }
    const response = await fetch(`${RAGFLOW_BASE_URL}/api/new_conversation?user_id=${user_id}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
        },
    });
    const data = await response.json();
    return data.data.id; // Returning conversation ID
}

export async function getAnswer(conversation_id, question) {
    if (!API_KEY) {
        throw new Error('API key not set. Call setApiKey() first.');
    }
    const messages = JSON.stringify([{ role: "user", content: question }]);
    const response = await fetch(`${RAGFLOW_BASE_URL}/api/completion`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            conversation_id: conversation_id,
            messages: messages,
            stream: false, // Set to true if you want streamed responses
        }),
    });
    const data = await response.json();
    return data.data.answer; // Returning the answer
}
