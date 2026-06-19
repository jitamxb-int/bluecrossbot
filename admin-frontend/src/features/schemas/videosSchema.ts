export const videoIngestSchema = {
  files: {
    required:          true,
    allowedExtensions: ['.csv', '.json', '.xlsx'],
    maxFileSizeMB:     50,
  },
};
