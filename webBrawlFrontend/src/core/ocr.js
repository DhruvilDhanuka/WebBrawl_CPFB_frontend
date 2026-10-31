export async function toGrayscale(image) {
    const img = await createImageBitmap(image);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.filter = "grayscale(100%)";
    ctx.drawImage(img, 0, 0);
    return canvas;
}

export async function runOCR(image, onProgress) {
    const grayscaled = await toGrayscale(image);
    const { createWorker } = await import("tesseract.js");

    const worker = await createWorker("eng", 1, {
        logger: (m) => {
            if (m.status === "recognizing text") onProgress?.(m.progress);
        }
    });

    try {
        const { data } = await worker.recognize(grayscaled);
        return data;
    } finally {
        await worker.terminate();
    }
}