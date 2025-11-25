import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodType } from 'zod'; 
import { logger } from '../lib/logger.js';

// This ensures our middleware accepts *any* schema designed to validate the 
// shape of our Express request (body, query, params).
export const validate = (schema: ZodType<any, any, any>) => 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // The schema is expected to validate the structure of the request object
      // We explicitly pass the three possible input locations (body, query, params)
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn({ details: error.issues }, 'Zod Validation Error: Invalid request received');
        
        // Return a clean, filtered error message to the client (HTTP 400 Bad Request)
        return res.status(400).json({
          error: 'Invalid Request Data',
          details: error.issues.map((e) => ({
            // This joins the path array: e.g., ['body', 'filename'] -> 'body.filename'
            path: e.path.join('.'), 
            message: e.message,
          })),
        });
      }
      // If it's a non-Zod error (e.g., database error), pass it to the global handler
      next(error);
    }
  };