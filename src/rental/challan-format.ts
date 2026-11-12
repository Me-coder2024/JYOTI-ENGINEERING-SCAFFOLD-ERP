import {z} from 'zod';
export const challanFormatSchema=z.object({
 heading:z.string().trim().max(100).default(''),
 outward_title:z.string().trim().min(1).max(80).default('RENTAL MATERIAL - OUTWARD CHALLAN'),
 inward_title:z.string().trim().min(1).max(80).default('RENTAL MATERIAL - INWARD CHALLAN'),
 layout:z.enum(['reference','compact']).default('reference'),
 font_size:z.coerce.number().int().min(8).max(11).default(9),
 show_logo:z.boolean().default(true),
 footer:z.string().trim().max(160).default('')
});
export type ChallanFormat=z.infer<typeof challanFormatSchema>;
export const defaultChallanFormat=():ChallanFormat=>challanFormatSchema.parse({});
