// Stop words to filter out during similarity comparison
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will',
  'with', 'system', 'project', 'using', 'based', 'app', 'application', 'web'
]);

/**
 * Extracts normalized tokens (length >= 3) from text fields
 */
export function extractTokens(text) {
  if (!text) return [];
  const matches = text.toLowerCase().match(/[a-z0-9+#.]{3,}/g) || [];
  return [...new Set(matches.filter(token => !STOP_WORDS.has(token)))];
}

/**
 * Compares a draft proposal against existing projects.
 * Returns up to 4 matched projects sorted by overlapping keyword count.
 */
export function checkProjectSimilarity(proposal, existingProjects = []) {
  const proposalText = `${proposal.title || ''} ${proposal.desc || ''} ${proposal.problem || ''} ${proposal.features || ''} ${proposal.tech || ''}`;
  const proposalTokens = extractTokens(proposalText);

  if (proposalTokens.length === 0) return [];

  const results = existingProjects
    .filter(project => project.status !== 'Archived')
    .map(project => {
      const projectText = `${project.title || ''} ${project.description || project.desc || ''} ${project.features || ''} ${project.technologies || project.tech || ''} ${project.domain || ''}`;
      const projectTokens = extractTokens(projectText);
      const sharedTokens = proposalTokens.filter(token => projectTokens.includes(token));

      return {
        project,
        sharedKeywords: sharedTokens
      };
    })
    .filter(item => item.sharedKeywords.length >= 2)
    .sort((a, b) => b.sharedKeywords.length - a.sharedKeywords.length)
    .slice(0, 4);

  return results;
}
