import { Router } from 'express';
import { ContactController } from '../controllers/contactController';

const router = Router();
const contactController = new ContactController();

router.post('/contact', contactController.sendMessage);

export default router;