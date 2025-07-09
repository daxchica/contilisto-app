import React, { useState } from 'react';
import { supabase } from '../supabase';

const UploadPDF = () => {
  const [pdfFile, setPdfFile] = useState(null);

  const handleUpload = async () => {
    if (!pdfFile) return alert('No file selected');

    const fileExt = pdfFile.name.split('.').pop();
    const filePath = `${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('pdfs')
      .upload(filePath, pdfFile);

    if (error) {
      console.error('Upload error:', error.message);
    } else {
      console.log('Uploaded:', data);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setPdfFile(e.target.files[0])}
      />
      <button onClick={handleUpload}>Cargar PDF</button>
    </div>
  );
};

export default UploadPDF;