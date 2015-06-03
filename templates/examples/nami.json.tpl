{
  "id": "{{id}}",
  "name": "{{name}}",
  "extends": ["Component"],
  "revision": {{revision}},
  "author": {"name": "Your Company", "url": "https://example.com"},
  "version": "{{version}}",
  "owner": {"username": "daemon"},
  "properties": {
    "dummyparameter": {"default": "Dummy value", "description": "Dummy Parameter"}
  },
  "exports": {
    "helloworld" : {"arguments": ["name"], "options": {"shout": false}}
  },
  "installation": {
    "prefix": "{{name}}",
    "packaging": {
      "components": [{
        "name": "default",
        "owner": "root",
        "folders": [{
          "name": "test",
          "files": [{"origin": ["files/*", "scripts"]}],
          "tags": [{"name": "data", "pattern": "*/data"}]
        }],
        "tagOperations": {
          "data": [{
            "setPermissions": {"owner": "daemon", "permissions": "0777"}
          }]
        }
      }]
    }
  }
}
