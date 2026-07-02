const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, conversationController.getConversations);
router.post('/', authMiddleware, conversationController.createOrGetConversation);
router.delete('/:conversationId', authMiddleware, conversationController.deleteConversation);

module.exports = router;