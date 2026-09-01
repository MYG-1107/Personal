const USE_MOCK_DATA = false;

const mockFiles = [
  {
    id: 1,
    original_filename: 'Resume.pdf',
    mime_type: 'application/pdf',
    file_size: 2400000,
    category: 'pdfs',
    uploaded_at: new Date().toISOString(),
    can_view_in_browser: true,
  },
  {
    id: 2,
    original_filename: 'Photo.jpg',
    mime_type: 'image/jpeg',
    file_size: 1200000,
    category: 'images',
    uploaded_at: new Date().toISOString(),
    can_view_in_browser: true,
  },
  {
    id: 3,
    original_filename: 'Notes.txt',
    mime_type: 'text/plain',
    file_size: 12288,
    category: 'text',
    uploaded_at: new Date().toISOString(),
    can_view_in_browser: true,
  },
];

const state = {
  files: [],
  search: '',
  category: 'all',
};

const elements = {
  fileTableBody: document.getElementById('fileTableBody'),
  searchInput: document.getElementById('searchInput'),
  categoryFilters: document.getElementById('categoryFilters'),
  uploadForm: document.getElementById('uploadForm'),
  fileInput: document.getElementById('fileInput'),
  uploadStatus: document.getElementById('uploadStatus'),
  uploadProgress: document.getElementById('uploadProgress'),
};

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeLabel(file) {
  if (file.category === 'images') return 'Image';
  if (file.category === 'pdfs') return 'PDF';
  if (file.category === 'documents') return 'Document';
  if (file.category === 'text') return 'Text';
  return 'Other';
}

function filteredFiles() {
  return state.files.filter((file) => {
    const matchesCategory = state.category === 'all' || file.category === state.category;
    const matchesSearch = file.original_filename
      .toLowerCase()
      .includes(state.search.toLowerCase().trim());

    return matchesCategory && matchesSearch;
  });
}

function showMessage(message, isError = false) {
  elements.uploadStatus.textContent = message;
  elements.uploadStatus.style.color = isError ? '#c1121f' : '#067d43';
}

function renderFiles() {
  const rows = filteredFiles();

  if (!rows.length) {
    elements.fileTableBody.innerHTML = '<tr><td colspan="5">No files found.</td></tr>';
    return;
  }

  elements.fileTableBody.innerHTML = rows
    .map(
      (file) => `
      <tr>
        <td>${file.original_filename}</td>
        <td>${fileTypeLabel(file)}</td>
        <td>${formatSize(file.file_size)}</td>
        <td>${new Date(file.uploaded_at).toLocaleString()}</td>
        <td class="actions">
          <button data-action="view" data-id="${file.id}">View</button>
          <button data-action="download" data-id="${file.id}">Download</button>
          <button data-action="share" data-id="${file.id}">Share</button>
          <button data-action="delete" data-id="${file.id}">Delete</button>
        </td>
      </tr>
    `,
    )
    .join('');
}

async function fetchFiles() {
  if (USE_MOCK_DATA) {
    state.files = mockFiles;
    renderFiles();
    return;
  }

  const params = new URLSearchParams();
  if (state.search.trim()) params.set('search', state.search.trim());
  if (state.category !== 'all') params.set('category', state.category);

  const response = await fetch(`/api/files?${params.toString()}`);

  if (response.status === 401) {
    showMessage('Please login first to manage files.', true);
    state.files = mockFiles;
    renderFiles();
    return;
  }

  const data = await response.json();
  if (!response.ok) {
    showMessage(data.error || 'Unable to load files.', true);
    return;
  }

  state.files = data.files;
  renderFiles();
}

function uploadFilesWithProgress(files) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    for (const file of files) {
      formData.append('files', file);
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const progress = Math.round((event.loaded / event.total) * 100);
      elements.uploadProgress.value = progress;
    };

    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText || '{}');
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
        return;
      }
      reject(new Error(data.error || 'Unable to upload file.'));
    };

    xhr.onerror = () => reject(new Error('Network error while uploading.'));

    xhr.open('POST', '/api/files/upload');
    xhr.send(formData);
  });
}

async function onUploadSubmit(event) {
  event.preventDefault();

  const selectedFiles = [...elements.fileInput.files];
  if (!selectedFiles.length) {
    showMessage('Please choose at least one file.', true);
    return;
  }

  if (USE_MOCK_DATA) {
    showMessage('Mock mode is enabled. Upload uses placeholders only.');
    return;
  }

  elements.uploadProgress.hidden = false;
  elements.uploadProgress.value = 0;
  showMessage('Uploading...');

  try {
    await uploadFilesWithProgress(selectedFiles);
    elements.uploadForm.reset();
    showMessage('File uploaded successfully.');
    await fetchFiles();
  } catch (error) {
    showMessage(error.message || 'Unable to upload file.', true);
  } finally {
    elements.uploadProgress.hidden = true;
  }
}

async function onTableAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;

  if (action === 'view') {
    window.open(`/api/files/${id}/view`, '_blank', 'noopener,noreferrer');
    return;
  }

  if (action === 'download') {
    window.location.href = `/api/files/${id}/download`;
    return;
  }

  if (action === 'share') {
    const response = await fetch(`/api/files/${id}/share`, { method: 'POST' });
    const data = await response.json();

    if (!response.ok) {
      showMessage(data.error || 'Unable to create share link.', true);
      return;
    }

    await navigator.clipboard.writeText(data.share_url);
    showMessage('Share link created and copied to clipboard.');
    return;
  }

  if (action === 'delete') {
    const confirmed = window.confirm('Delete this file?');
    if (!confirmed) return;

    const response = await fetch(`/api/files/${id}`, { method: 'DELETE' });
    const data = await response.json();

    if (!response.ok) {
      showMessage(data.error || 'Unable to delete file.', true);
      return;
    }

    showMessage(data.message || 'File deleted successfully.');
    await fetchFiles();
  }
}

function onSearchInput(event) {
  state.search = event.target.value;
  fetchFiles().catch((error) => showMessage(error.message || 'Unable to search files.', true));
}

function onCategoryClick(event) {
  const button = event.target.closest('button[data-category]');
  if (!button) return;

  state.category = button.dataset.category;

  for (const filterButton of elements.categoryFilters.querySelectorAll('button')) {
    filterButton.classList.toggle('active', filterButton === button);
  }

  fetchFiles().catch((error) => showMessage(error.message || 'Unable to filter files.', true));
}

function initialize() {
  elements.searchInput.addEventListener('input', onSearchInput);
  elements.categoryFilters.addEventListener('click', onCategoryClick);
  elements.uploadForm.addEventListener('submit', onUploadSubmit);
  elements.fileTableBody.addEventListener('click', onTableAction);

  fetchFiles().catch((error) => showMessage(error.message || 'Unable to load files.', true));
}

initialize();
