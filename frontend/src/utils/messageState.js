export const getClientMessageId = message => (
    message?.client_message_id
    || message?.clientMessageId
    || message?.client_upload_id
    || null
);

const getNumericMessageId = message => {
    const id = Number(message?.id);
    return Number.isInteger(id) && id > 0 ? id : null;
};

export const upsertMessage = (messages, incomingMessage) => {
    const clientMessageId = getClientMessageId(incomingMessage);
    const incomingId = getNumericMessageId(incomingMessage);
    const index = messages.findIndex(message => {
        const currentClientMessageId = getClientMessageId(message);
        const currentId = getNumericMessageId(message);
        return (
            (clientMessageId && currentClientMessageId === clientMessageId)
            || (incomingId && currentId === incomingId)
        );
    });
    if (index < 0) return [...messages, incomingMessage];

    const {
        send_status: _sendStatus,
        send_error: _sendError,
        upload_status: _uploadStatus,
        upload_progress: _uploadProgress,
        upload_error: _uploadError,
        _retryContent,
        _uploadFiles,
        ...currentMessage
    } = messages[index];
    const nextMessages = [...messages];
    nextMessages[index] = { ...currentMessage, ...incomingMessage };
    return nextMessages;
};

export const mergeMessages = (currentMessages, incomingMessages) => (
    incomingMessages.reduce(
        (mergedMessages, message) => upsertMessage(mergedMessages, message),
        currentMessages
    ).sort((left, right) => {
        const leftTimestamp = Date.parse(left?.created_at || '');
        const rightTimestamp = Date.parse(right?.created_at || '');
        const normalizedLeftTimestamp = Number.isFinite(leftTimestamp) ? leftTimestamp : 0;
        const normalizedRightTimestamp = Number.isFinite(rightTimestamp) ? rightTimestamp : 0;
        if (normalizedLeftTimestamp !== normalizedRightTimestamp) {
            return normalizedLeftTimestamp - normalizedRightTimestamp;
        }

        return (getNumericMessageId(left) || Number.MAX_SAFE_INTEGER)
            - (getNumericMessageId(right) || Number.MAX_SAFE_INTEGER);
    })
);
