<?php
// Proxy: browser -> this script -> coupon.netmarble.com
// Upload to: https://online-multiservice.com/7k/redeem/api/redeem.php

$allowedOrigins = [
    'https://bearcarrot.github.io',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

function out($status, $arr) {
    http_response_code($status);
    echo json_encode($arr, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    out(405, ['success' => false, 'errorMessage' => 'method not allowed']);
}

$in = json_decode(file_get_contents('php://input'), true);
$code = is_array($in) ? trim((string)($in['couponCode'] ?? '')) : '';
$pid  = is_array($in) ? trim((string)($in['pid'] ?? '')) : '';

if (!preg_match('/^[A-Za-z0-9]{1,40}$/', $code)) {
    out(400, ['success' => false, 'errorMessage' => 'invalid coupon code']);
}
if (!preg_match('/^[A-F0-9]{32}$/', $pid)) {
    out(400, ['success' => false, 'errorMessage' => 'invalid pid']);
}

$payload = json_encode([
    'gameCode'   => 'tskgb',
    'couponCode' => $code,
    'langCd'     => 'TH_TH',
    'pid'        => $pid,
]);

$url = 'https://coupon.netmarble.com/api/coupon';
$headers = [
    'Accept: application/json, text/plain, */*',
    'Content-Type: application/json',
];

$body = false;
if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_ENCODING       => '',
    ]);
    $body = curl_exec($ch);
    curl_close($ch);
} elseif (ini_get('allow_url_fopen')) {
    $ctx = stream_context_create(['http' => [
        'method'        => 'POST',
        'header'        => implode("\r\n", $headers),
        'content'       => $payload,
        'timeout'       => 15,
        'ignore_errors' => true,
    ]]);
    $body = @file_get_contents($url, false, $ctx);
}

if ($body === false || $body === '') {
    out(502, ['success' => false, 'errorMessage' => 'upstream unreachable']);
}

$json = json_decode($body, true);
if (!is_array($json)) {
    out(502, ['success' => false, 'errorMessage' => 'upstream returned non-JSON']);
}

echo json_encode($json, JSON_UNESCAPED_UNICODE);
