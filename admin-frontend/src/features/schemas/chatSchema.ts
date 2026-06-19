// Validation shape for chat forms — swap bodies for zod schemas when added

export const chatRequestSchema = {
  message:    { required: true,  minLength: 1, maxLength: 2000 },
  session_id: { required: false },
  top_k:      { required: false, min: 1, max: 100 },
};
