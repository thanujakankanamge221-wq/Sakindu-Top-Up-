<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

if (!isset($_GET['uid']) || empty($_GET['uid'])) {
    echo json_encode([
        "status" => "error",
        "message" => "UID parameter is required"
    ]);
    exit;
}

$uid = preg_replace('/[^0-9]/', '', $_GET['uid']);

$url = "https://shop.garena.sg/api/auth/player_id_login";

$payload = json_encode([
    "app_id" => 100067,
    "login_id" => strval($uid)
]);

$ch = curl_init($url);

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json",
    "User-Agent: Mozilla/5.0"
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    echo json_encode([
        "status" => "error",
        "message" => "Connection Error"
    ]);
    curl_close($ch);
    exit;
}

curl_close($ch);

if ($httpCode == 200) {
    $data = json_decode($response, true);

    if (isset($data['nickname']) && !empty($data['nickname'])) {
        echo json_encode([
            "status" => "success",
            "uid" => $uid,
            "nickname" => $data['nickname']
        ]);
    } else {
        echo json_encode([
            "status" => "error",
            "message" => "Player Not Found"
        ]);
    }
} else {
    echo json_encode([
        "status" => "error",
        "message" => "Garena API Error"
    ]);
}
?>