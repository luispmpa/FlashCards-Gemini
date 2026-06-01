export async function uploadImageFromPaste(file: File): Promise<string> {
    const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
    
    if (!apiKey) {
        throw new Error("Chave da API do ImgBB não encontrada. Adicione VITE_IMGBB_API_KEY nas variáveis de ambiente.");
    }

    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error("Falha ao fazer upload da imagem");
    }

    const data = await response.json();
    return data.data.url;
}
