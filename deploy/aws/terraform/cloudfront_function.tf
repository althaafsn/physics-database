resource "aws_cloudfront_function" "rewrite_index" {
  name    = "${var.project_name}-rewrite-index"
  runtime = "cloudfront-js-2.0"
  comment = "Append index.html for directory-style Next.js export paths"
  publish = true
  code    = <<-EOF
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.endsWith('/')) {
    request.uri += 'index.html';
  } else if (!uri.includes('.')) {
    request.uri += '/index.html';
  }
  return request;
}
EOF
}
