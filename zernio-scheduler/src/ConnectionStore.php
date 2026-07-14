<?php

/**
 * Persists the set of Zernio API connections (one per Zernio account) as a
 * JSON file on disk. This is what makes the dashboard "unified": each
 * connection is a separate API key, and every screen aggregates across all
 * of them.
 *
 * The file lives outside the web root and is git-ignored, so keys never get
 * served or committed.
 *
 * Shape of each connection:
 *   ['id' => 'conn_ab12…', 'label' => 'Client A', 'apiKey' => 'sk_…', 'baseUrl' => 'https://…']
 */
class ConnectionStore
{
    private string $file;

    public function __construct(string $file)
    {
        $this->file = $file;
    }

    /** @return array<int, array{id:string,label:string,apiKey:string,baseUrl:string}> */
    public function all(): array
    {
        if (!is_file($this->file)) {
            return [];
        }
        $raw  = file_get_contents($this->file);
        $data = json_decode($raw ?: '[]', true);
        return is_array($data) ? array_values($data) : [];
    }

    public function get(string $id): ?array
    {
        foreach ($this->all() as $conn) {
            if ($conn['id'] === $id) {
                return $conn;
            }
        }
        return null;
    }

    /**
     * Add a connection. Returns the created record.
     *
     * @throws RuntimeException if the data directory can't be written.
     */
    public function add(string $label, string $apiKey, string $baseUrl = 'https://zernio.com/api/v1'): array
    {
        $conns = $this->all();
        $conn  = [
            'id'      => 'conn_' . bin2hex(random_bytes(6)),
            'label'   => $label,
            'apiKey'  => $apiKey,
            'baseUrl' => $baseUrl !== '' ? $baseUrl : 'https://zernio.com/api/v1',
        ];
        $conns[] = $conn;
        $this->save($conns);
        return $conn;
    }

    public function remove(string $id): void
    {
        $conns = array_values(array_filter(
            $this->all(),
            static fn (array $c): bool => $c['id'] !== $id
        ));
        $this->save($conns);
    }

    /** True if a connection with this API key already exists. */
    public function hasKey(string $apiKey): bool
    {
        foreach ($this->all() as $conn) {
            if (hash_equals($conn['apiKey'], $apiKey)) {
                return true;
            }
        }
        return false;
    }

    private function save(array $conns): void
    {
        $dir = dirname($this->file);
        if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
            throw new RuntimeException('Could not create data directory: ' . $dir);
        }
        $json = json_encode(array_values($conns), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if (file_put_contents($this->file, $json, LOCK_EX) === false) {
            throw new RuntimeException('Could not write connections file: ' . $this->file);
        }
        @chmod($this->file, 0600);
    }
}
