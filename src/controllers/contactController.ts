 // src/controllers/contactController.ts
 import { Request, Response } from 'express';
import { ContactService } from '../services/contactService';

 
 export class ContactController {
   private contactService: ContactService;
 
   constructor() {
     this.contactService = new ContactService();
   }
 
   public sendMessage = async (req: Request, res: Response): Promise<void> => {
     try {
       const { name, email, message } = req.body;
 
       // Basic validation
       if (!name || !email || !message) {
         res.status(400).json({
           success: false,
           error: 'Missing required fields'
         });
         return;
       }
 
       // Email format validation
       const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
       if (!emailRegex.test(email)) {
         res.status(400).json({
           success: false,
           error: 'Invalid email format'
         });
         return;
       }
 
       // Validate service connection
       const isValid = await this.contactService.validateConnection();
       if (!isValid) {
         res.status(503).json({
           success: false,
           error: 'Service unavailable'
         });
         return;
       }
 
       // Send message
       await this.contactService.sendMessage({ name, email, message });
 
       res.status(200).json({
         success: true,
         message: 'Message sent successfully'
       });
 
     } catch (error) {
       console.error('Contact Controller Error:', error);
       res.status(500).json({
         success: false,
         error: 'Failed to send message',
         details: error instanceof Error ? error.message : 'Unknown error'
       });
     }
   };
 }
 