import { supabase } from './supabase.js';

export const PROJECT_FILES_BUCKET = 'project-submissions';
export const REPORT_MAX_BYTES = 20 * 1024 * 1024;
export const DEMO_VIDEO_MAX_BYTES = 500 * 1024 * 1024;

const REPORT_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const VIDEO_TYPES = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  m4v: 'video/x-m4v',
};

function getFileType(file, allowedTypes) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const expectedType = allowedTypes[extension];
  if (!expectedType) throw new Error(`Unsupported file type: ${file.name}`);
  if (file.type && file.type !== expectedType) {
    throw new Error(`The file type for ${file.name} does not match its extension.`);
  }
  return expectedType;
}

function makeObjectPath(userId, projectId, file) {
  const safeName = file.name
    .replace(/[^\w.-]+/g, '-')
    .replace(/^\.+/, '')
    .slice(-120) || 'upload';
  return `${userId}/${projectId}/${crypto.randomUUID()}-${safeName}`;
}

export async function uploadSubmissionFiles({
  userId,
  projectId,
  reportFile,
  videoFile,
  onVideoProgress,
}) {
  const uploadedPaths = [];
  let reportPath = null;
  let videoPath = null;

  try {
    if (reportFile) {
      if (reportFile.size > REPORT_MAX_BYTES) {
        throw new Error('The project report must be 20 MB or smaller.');
      }
      getFileType(reportFile, REPORT_TYPES);
      const { data, error } = await supabase.storage
        .from(PROJECT_FILES_BUCKET)
        .upload(makeObjectPath(userId, projectId, reportFile), reportFile);
      if (error) throw new Error(`Project report upload failed: ${error.message}`);
      reportPath = data.path;
      uploadedPaths.push(reportPath);
    }

    if (videoFile) {
      if (videoFile.size > DEMO_VIDEO_MAX_BYTES) {
        throw new Error('The demo video must be 500 MB or smaller.');
      }
      getFileType(videoFile, VIDEO_TYPES);
      const { data, error } = await supabase.storage
        .from(PROJECT_FILES_BUCKET)
        .uploadWithProgress(projectId, videoFile, onVideoProgress);
      if (error) throw new Error(`Demo video upload failed: ${error.message}`);
      videoPath = data.path;
      uploadedPaths.push(videoPath);
    }

    return { reportPath, videoPath, uploadedPaths };
  } catch (uploadError) {
    if (uploadedPaths.length) {
      const { error: cleanupError } = await supabase.storage
        .from(PROJECT_FILES_BUCKET)
        .remove(uploadedPaths);
      if (cleanupError) {
        throw new Error(`${uploadError.message} Temporary uploaded files could not be removed: ${cleanupError.message}`);
      }
    }
    throw uploadError;
  }
}

export async function removeSubmissionFiles(paths) {
  if (paths.length === 0) return;
  const { error } = await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .remove(paths);
  if (error) throw new Error(`Uploaded files could not be cleaned up: ${error.message}`);
}
