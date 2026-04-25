import { z } from "zod";

export const JidSchema = z
  .string()
  .min(1)
  .describe("WhatsApp JID (e.g. 5511999999999@s.whatsapp.net or group@g.us)");

export const PhoneOrJidSchema = z
  .string()
  .min(1)
  .describe("Recipient JID or phone number (e.g. 5511999999999 or group@g.us)");

export const LimitSchema = z
  .number()
  .int()
  .positive()
  .optional()
  .describe("Max items to return (default 50)");
