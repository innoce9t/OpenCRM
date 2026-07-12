<?php

/**
 * Thin HTTP wrapper around the Zernio REST API (https://zernio.com/api/v1).
 *
 * We talk to the REST API directly with cURL rather than depending on the
 * PHP SDK so the app stays dependency-free and the request/response shapes
 * are explicit.
 */
class ZernioClient
{
    private string $apiKey;
    private string $baseUrl;

    public function __construct(string $apiKey, string $baseUrl = 'https://zernio.com/api/v1')
    {
        $this->apiKey  = $apiKey;
        $this->baseUrl = rtrim($baseUrl, '/');
    }

    /**
     * Perform an API request.
     *
     * @param string     $method HTTP verb (GET, POST, ...).
     * @param string     $path   Path beginning with "/", e.g. "/posts".
     * @param array|null $body   Request body, JSON-encoded when present.
     * @param array      $query  Query-string parameters.
     *
     * @return array{status:int, data:mixed, error:?string}
     */
    public function request(string $method, string $path, ?array $body = null, array $query = []): array
    {
        $url = $this->baseUrl . $path;
        if ($query !== []) {
            $url .= '?' . http_build_query($query);
        }

        $headers = [
            'Authorization: Bearer ' . $this->apiKey,
            'Accept: application/json',
        ];

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => strtoupper($method),
            CURLOPT_TIMEOUT        => 30,
        ]);

        if ($body !== null) {
            $headers[] = 'Content-Type: application/json';
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_SLASHES));
        }

        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        $raw    = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($raw === false) {
            return ['status' => 0, 'data' => null, 'error' => 'Network error: ' . $curlErr];
        }

        $data = json_decode($raw, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $data = $raw; // Return raw body when it isn't JSON.
        }

        $error = null;
        if ($status < 200 || $status >= 300) {
            $error = is_array($data) && isset($data['error'])
                ? (is_string($data['error']) ? $data['error'] : json_encode($data['error']))
                : (is_array($data) && isset($data['message']) ? $data['message'] : 'Request failed with status ' . $status);
        }

        return ['status' => $status, 'data' => $data, 'error' => $error];
    }

    // ---- Profiles -------------------------------------------------------

    public function listProfiles(): array
    {
        return $this->request('GET', '/profiles');
    }

    public function createProfile(string $name, string $description = ''): array
    {
        return $this->request('POST', '/profiles', [
            'name'        => $name,
            'description' => $description,
        ]);
    }

    // ---- Accounts -------------------------------------------------------

    public function listAccounts(): array
    {
        return $this->request('GET', '/accounts');
    }

    public function getConnectUrl(string $platform, string $profileId): array
    {
        return $this->request('GET', '/connect/' . rawurlencode($platform), null, [
            'profileId' => $profileId,
        ]);
    }

    // ---- Posts ----------------------------------------------------------

    public function listPosts(): array
    {
        return $this->request('GET', '/posts');
    }

    /**
     * Create a post. See buildPostBody() for the shape of $body.
     */
    public function createPost(array $body): array
    {
        return $this->request('POST', '/posts', $body);
    }
}
