const path = require('node:path');

function detectCategory(fileName, mimeType = '') {
  const lowerName = fileName.toLowerCase();
  const ext = path.extname(lowerName);

  if (mimeType.startsWith('image/')) return 'images';
  if (mimeType === 'application/pdf' || ext === '.pdf') return 'pdfs';
  if (mimeType.startsWith('text/') || ['.txt', '.md', '.csv', '.json'].includes(ext)) return 'text';
  if (
    [
      '.doc',
      '.docx',
      '.xls',
      '.xlsx',
      '.ppt',
      '.pptx',
      '.odt',
      '.ods',
      '.rtf',
    ].includes(ext)
  ) {
    return 'documents';
  }
  return 'others';
}

function isViewableInBrowser(mimeType = '', fileName = '') {
  const ext = path.extname(fileName.toLowerCase());
  if (mimeType.startsWith('image/')) return true;
  if (mimeType.startsWith('text/')) return true;
  if (mimeType === 'application/pdf') return true;
  return ['.txt', '.md', '.json', '.csv', '.pdf'].includes(ext);
}

module.exports = {
  detectCategory,
  isViewableInBrowser,
};
