// Sugestão automática de categoria a partir de palavras-chave na descrição
// do lançamento. É apenas uma sugestão: o usuário pode revisar/alterar antes
// de importar. Retorna o id da categoria do usuário cujo NOME casar com a
// descrição (match simples por substring, sem acento e em minúsculas).

type CategoryLike = { id: string; name: string };

function normalize(s: string): string {
    return s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
}

export function suggestCategoryId(
    description: string | undefined,
    categories: CategoryLike[],
): string | undefined {
    if (!description) return undefined;

    const desc = normalize(description);

    for (const cat of categories) {
        const name = normalize(cat.name);
        if (name.length >= 3 && desc.includes(name)) {
            return cat.id;
        }
    }

    return undefined;
}
