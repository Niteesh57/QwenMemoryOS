/**
 * Renders standard HTML wrap for normal text answers stored in result storage.
 * @param {string} answer 
 * @returns {string}
 */
export const renderHtmlResult = (answer) => {
  return `<!DOCTYPE html><html><body style="background:#0d0915;color:#f8fafc;font-family:sans-serif;padding:16px"><p>${answer}</p></body></html>`;
};

/**
 * Renders HTML for non-existent result IDs.
 * @returns {string}
 */
export const renderNotFound = () => {
  return "<html><body><h3>Result not found</h3></body></html>";
};
