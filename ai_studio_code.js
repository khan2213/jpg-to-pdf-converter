const jpgInput = document.getElementById('jpgInput');
const convertBtn = document.getElementById('convertBtn');
const messageDiv = document.getElementById('message');
const loadingDiv = document.getElementById('loading');
const downloadLink = document.getElementById('downloadLink');

// Ensure pdf-lib is available (it's loaded via CDN in index.html)
const { PDFDocument, rgb, StandardFonts } = PDFLib;

let selectedFiles = [];

// --- UI Utility Functions ---
function showMessage(msg, type) {
    messageDiv.textContent = msg;
    messageDiv.className = ''; // Clear previous classes
    messageDiv.classList.add('message-' + type);
    messageDiv.classList.remove('hidden');
}

function hideMessage() {
    messageDiv.classList.add('hidden');
}

function showLoading() {
    loadingDiv.classList.remove('hidden');
    hideMessage();
    downloadLink.classList.add('hidden');
    convertBtn.disabled = true;
}

function hideLoading() {
    loadingDiv.classList.add('hidden');
    convertBtn.disabled = selectedFiles.length === 0; // Re-enable if files are selected
}

function showDownloadLink(blobUrl) {
    downloadLink.href = blobUrl;
    downloadLink.classList.remove('hidden');
}

function disableConvertButton() {
    convertBtn.disabled = true;
}

// --- Event Listeners ---
jpgInput.addEventListener('change', (event) => {
    selectedFiles = Array.from(event.target.files).filter(file =>
        file.type === 'image/jpeg' || file.type === 'image/jpg'
    );

    if (selectedFiles.length > 0) {
        convertBtn.disabled = false;
        hideMessage();
        downloadLink.classList.add('hidden');
        showMessage(`${selectedFiles.length} JPG file(s) selected.`, 'success');
    } else {
        convertBtn.disabled = true;
        showMessage('Please select one or more JPG files.', 'error');
    }
});

convertBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) {
        showMessage('No JPG files selected for conversion.', 'error');
        return;
    }

    showLoading();
    disableConvertButton(); // Disable while processing

    try {
        const pdfDoc = await PDFDocument.create();
        // const font = await pdfDoc.embedFont(StandardFonts.Helvetica); // Optional: if you want to add text

        for (const file of selectedFiles) {
            const reader = new FileReader();

            // Wrap FileReader in a Promise to handle async reads
            await new Promise((resolve, reject) => {
                reader.onload = async (e) => {
                    try {
                        const jpgBytes = new Uint8Array(e.target.result);
                        const jpgImage = await pdfDoc.embedJpg(jpgBytes);
                        const page = pdfDoc.addPage();

                        // Calculate dimensions to fit image on page
                        const { width: imgWidth, height: imgHeight } = jpgImage.scale(1);
                        const { width: pageWidth, height: pageHeight } = page.getSize();

                        // Maintain aspect ratio while fitting
                        const scaleX = pageWidth / imgWidth;
                        const scaleY = pageHeight / imgHeight;
                        const scale = Math.min(scaleX, scaleY);

                        const scaledWidth = imgWidth * scale;
                        const scaledHeight = imgHeight * scale;

                        // Center the image
                        const x = (pageWidth - scaledWidth) / 2;
                        const y = (pageHeight - scaledHeight) / 2;

                        page.drawImage(jpgImage, {
                            x,
                            y,
                            width: scaledWidth,
                            height: scaledHeight,
                        });

                        resolve();
                    } catch (innerError) {
                        console.error('Error embedding JPG:', innerError);
                        reject(new Error(`Failed to embed ${file.name}: ${innerError.message}`));
                    }
                };

                reader.onerror = (error) => {
                    console.error('File reading error:', error);
                    reject(new Error(`Failed to read file ${file.name}`));
                };

                reader.readAsArrayBuffer(file);
            });
        }

        const pdfBytes = await pdfDoc.save();
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(pdfBlob);

        hideLoading();
        showDownloadLink(pdfUrl);
        showMessage('Conversion successful! Click download to get your PDF.', 'success');

        // Clean up the object URL after a short delay (or when the page unloads)
        // URL.revokeObjectURL(pdfUrl); // Consider when to revoke, usually after download or on page close
    } catch (error) {
        console.error('PDF conversion failed:', error);
        hideLoading();
        showMessage(`Error during PDF conversion: ${error.message}`, 'error');
    } finally {
        hideLoading(); // Ensure loading is hidden even on error
    }
});