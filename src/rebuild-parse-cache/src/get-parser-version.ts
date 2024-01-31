export function getParserVersion(dockerfileStr: string): string {
  // Searches for the SNOOTY_PARSER_VERSION in Dockerfile.enhanced.
  // This should return an array with a single element e.g. [ 'SNOOTY_PARSER_VERSION=0.15.2' ]
  const matchResult = dockerfileStr.match(
    /SNOOTY_PARSER_VERSION=\d+.\d+.(\d+)?/g,
  );

  if (!matchResult)
    throw new Error(
      'ERROR! Could not find SNOOTY_PARSER_VERSION in Dockerfile.enhanced',
    );

  // Grabbing the string 'SNOOTY_PARSER_VERSION=0.15.2', splitting using the '=' as the
  // delimiter, and then grabbing the second value which should be the parser version.
  const currentVersion = matchResult[0].split('=')[1];

  // Trimming just in case any extra whitespace finds its way into the result
  return currentVersion.trim();
}
