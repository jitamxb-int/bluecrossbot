export const productIngestSchema = {
  files: {
    required:          true,
    allowedExtensions: ['.csv', '.json', '.xlsx'],
    maxFileSizeMB:     50,
  },
};
