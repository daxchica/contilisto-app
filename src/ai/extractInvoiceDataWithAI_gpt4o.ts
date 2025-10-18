export async function extractInvoiceFromAPI(fullText: string, entityRUC: string, entityType: string) {
  console.log("Sending to extract-invoice:", { text: fullText?.slice(0, 300), entityRUC });
  const res = await fetch('/.netlify/functions/extract-Invoice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fullText, entityRUC }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.error || 'Error fetching from extract-Invoice');
  }

  const data = await res.json();
  return data;
}