<?php
header('Content-Type: application/json');
$input = file_get_contents('php://input');
$data = json_decode($input, true);
if (!$data) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid JSON"]);
  exit;
}
$file = __DIR__ . '/../data/covers.json';
if (file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT))) {
  echo json_encode(["success" => true, "message" => "Covers saved"]);
} else {
  http_response_code(500);
  echo json_encode(["error" => "Failed to write file"]);
}
?>
