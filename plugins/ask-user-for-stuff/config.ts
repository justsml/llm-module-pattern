// examples/ask-user-for-stuff/config.ts
import { z } from 'zod';

export const askUserPluginConfig = {
  id: 'ask-user-for-stuff',
  name: 'Ask User for Stuff Plugin',
  version: '1.0.0',
} as const;

// =============================================================================
// Confirmation Tool Schemas
// =============================================================================

export const confirmationInputSchema = z.object({
  title: z.string().describe('Title for the confirmation dialog'),
  message: z.string().describe('Message explaining what needs confirmation'),
  confirmLabel: z.string().default('Confirm').describe('Label for confirm button'),
  cancelLabel: z.string().default('Cancel').describe('Label for cancel button'),
  variant: z.enum(['default', 'warning', 'danger']).default('default'),
});

export const confirmationOutputSchema = z.object({
  confirmed: z.boolean().describe('Whether the user confirmed'),
  timestamp: z.string().describe('When the user responded'),
});

export type ConfirmationInput = z.infer<typeof confirmationInputSchema>;
export type ConfirmationOutput = z.infer<typeof confirmationOutputSchema>;

// =============================================================================
// Multiple Choice Tool Schemas
// =============================================================================

export const multipleChoiceInputSchema = z.object({
  question: z.string().describe('The question to ask'),
  options: z.array(
    z.object({
      id: z.string().describe('Unique identifier for this option'),
      label: z.string().describe('Display label'),
      description: z.string().optional().describe('Optional description'),
      icon: z.string().optional().describe('Optional icon name'),
    })
  ).min(2).describe('Available options (minimum 2)'),
  allowMultiple: z.boolean().default(false).describe('Allow selecting multiple options'),
});

export const multipleChoiceOutputSchema = z.object({
  selected: z.array(z.string()).describe('IDs of selected options'),
  timestamp: z.string().describe('When the user responded'),
});

export type MultipleChoiceInput = z.infer<typeof multipleChoiceInputSchema>;
export type MultipleChoiceOutput = z.infer<typeof multipleChoiceOutputSchema>;

// =============================================================================
// Text Input Tool Schemas
// =============================================================================

export const textInputSchema = z.object({
  prompt: z.string().describe('Prompt/label for the input'),
  placeholder: z.string().optional().describe('Placeholder text'),
  multiline: z.boolean().default(false).describe('Allow multiline input'),
  required: z.boolean().default(true).describe('Whether input is required'),
});

export const textOutputSchema = z.object({
  value: z.string().describe('The user\'s input'),
  timestamp: z.string().describe('When the user responded'),
});

export type TextInput = z.infer<typeof textInputSchema>;
export type TextOutput = z.infer<typeof textOutputSchema>;
