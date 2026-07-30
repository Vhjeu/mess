import assert from 'node:assert/strict';
import test from 'node:test';
import {
    mergeMessages,
    upsertMessage
} from './messageState.js';

test('socket/API thay optimistic message theo client_message_id mà không tạo bản sao', () => {
    const optimistic = {
        id: 'pending:client-1',
        client_message_id: 'client-1',
        content: 'Tin đầu tiên',
        send_status: 'sending'
    };
    const saved = {
        id: 42,
        client_message_id: 'client-1',
        conversation_id: 7,
        content: 'Tin đầu tiên'
    };

    const messages = upsertMessage([optimistic], saved);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].id, 42);
    assert.equal(messages[0].send_status, undefined);
});

test('response API lặp lại sau socket được dedupe theo message id', () => {
    const socketMessage = {
        id: 42,
        client_message_id: 'client-1',
        content: 'Tin đầu tiên'
    };
    const apiMessage = { ...socketMessage, created_at: '2026-07-30T12:00:00.000Z' };

    const messages = upsertMessage([socketMessage], apiMessage);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].created_at, apiMessage.created_at);
});

test('history tải nền được merge mà không xóa optimistic message', () => {
    const optimistic = {
        id: 'pending:client-2',
        client_message_id: 'client-2',
        content: 'Đang gửi',
        send_status: 'sending'
    };
    const history = [{ id: 1, content: 'Tin cũ' }];

    const messages = mergeMessages([optimistic], history);
    assert.equal(messages.length, 2);
    assert.ok(messages.some(message => message.client_message_id === 'client-2'));
    assert.ok(messages.some(message => message.id === 1));
});

test('background history is sorted before a newer optimistic message', () => {
    const optimistic = {
        id: 'pending:client-3',
        client_message_id: 'client-3',
        created_at: '2026-01-02T00:00:00.000Z'
    };
    const history = [{
        id: 2,
        created_at: '2026-01-01T00:00:00.000Z'
    }];

    const messages = mergeMessages([optimistic], history);
    assert.equal(messages[0].id, 2);
    assert.equal(messages[1].client_message_id, 'client-3');
});
