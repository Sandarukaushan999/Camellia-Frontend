import api from "../utils/api.js";

function parseFileName(contentDisposition) {
  if (!contentDisposition) {
    return `camellia-backup-${Date.now()}.csv`;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const simpleMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  if (simpleMatch?.[1]) {
    return simpleMatch[1];
  }

  return `camellia-backup-${Date.now()}.csv`;
}

export const adminAPI = {
  async downloadBackup() {
    const response = await api.get("/admin/backup/csv", {
      responseType: "blob",
    });

    return {
      blob: response.data,
      fileName: parseFileName(response.headers?.["content-disposition"]),
    };
  },

  async restoreFromBackup(file) {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post("/admin/restore/csv", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  async resetSystem(secretCode) {
    const { data } = await api.post("/admin/reset", { secretCode });
    return data;
  },
};

export function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || `camellia-backup-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
