const assert = require('node:assert/strict');
const test = require('node:test');
const {
    buildSendResponse,
    normalizeClientMessageId
} = require('../controllers/messageController');

test('clientMessageId hợp lệ được giữ nguyên cho ACK/socket dedupe', () => {
    assert.equal(
        normalizeClientMessageId('message:550e8400-e29b-41d4-a716-446655440000'),
        'message:550e8400-e29b-41d4-a716-446655440000'
    );
    assert.equal(normalizeClientMessageId(null), null);
});

test('clientMessageId không hợp lệ bị từ chối', () => {
    assert.throws(
        () => normalizeClientMessageId('bad id with spaces'),
        error => error.status === 400
    );
    assert.throws(
        () => normalizeClientMessageId('x'.repeat(101)),
        error => error.status === 400
    );
});

test('ACK trả message đầy đủ và trạng thái tạo conversation', () => {
    const message = {
        id: 91,
        conversation_id: 12,
        content: 'Tin đầu tiên',
        created_at: '2026-07-30T12:00:00.000Z',
        client_message_id: 'client-1'
    };
    const response = buildSendResponse({
        conversationId: 12,
        conversationCreated: true
    }, message);

    assert.deepEqual(response, {
        success: true,
        messageId: 91,
        conversationId: 12,
        conversation_id: 12,
        createdConversation: true,
        conversation: {
            id: 12,
            created: true
        },
        message
    });
});
