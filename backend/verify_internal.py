
import json
import yaml
import time
import sys
import os
import urllib.request
import urllib.parse
import urllib.error

# Inside container, we can hit localhost:8000
API_BASE = "http://localhost:8000/api"
CONFIG_FILE = "/app/shared_config/registers.yaml"
USERNAME = "engineer"
PASSWORD = "eng123"

def login():
    url = f"{API_BASE}/auth/login"
    data = urllib.parse.urlencode({'username': USERNAME, 'password': PASSWORD}).encode()
    req = urllib.request.Request(url, data=data, method='POST')
    # Default content type for urlencode is application/x-www-form-urlencoded, which is what OAuth2PasswordRequestForm expects
    
    try:
        with urllib.request.urlopen(req) as response:
            if response.status != 200:
                print(f"   LOGIN FAILED: HTTP {response.status}")
                return None
            body = json.loads(response.read().decode())
            return body.get("access_token")
    except Exception as e:
        print(f"   LOGIN FAILED: {e}")
        return None

def get_config(token):
    url = f"{API_BASE}/config/modbus"
    try:
        req = urllib.request.Request(url)
        # GET usually doesn't need auth if public? But let's add it if needed. 
        # routes/modbus_config.py: get_modbus_config -> Depends(get_db) only, no Auth?
        # Let's check. If it fails we add auth. But PUT definitely needs auth.
        
        with urllib.request.urlopen(req) as response:
            if response.status != 200:
                print(f"   GET FAILED: HTTP {response.status}")
                return None
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"   GET FAILED: {e}")
        return None

def put_config(payload, token):
    url = f"{API_BASE}/config/modbus"
    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, method='PUT')
        req.add_header('Content-Type', 'application/json')
        req.add_header('Authorization', f'Bearer {token}')
        
        with urllib.request.urlopen(req) as response:
            if response.status != 200:
                print(f"   PUT FAILED: HTTP {response.status}")
                return False
            return True
    except Exception as e:
        # print Error 401 etc
        print(f"   PUT FAILED: {e}")
        return False

def verify():
    print("0. Authenticating...")
    token = login()
    if not token:
        return False
    print("   Authentication successful.")

    print("1. Getting current config...")
    data = get_config(token)
    if not data:
        return False
    print(f"   Got config with {len(data['registers'])} registers.")

    # Find engine_oil_pressure (101)
    target_reg = next((r for r in data['registers'] if r['address'] == 101), None)
    if not target_reg:
        print("   FAILED: Could not find register 101 (engine_oil_pressure)")
        return False
    
    current_nominal = target_reg.get('nominal')
    print(f"   Current nominal: {current_nominal}")
    
    # Calculate new value
    try:
        curr_float = float(current_nominal)
    except:
        curr_float = 0.0

    if abs(curr_float - 75.5) < 0.1:
        new_val = 85.5
    else:
        new_val = 75.5
    
    target_reg['nominal'] = new_val
    target_reg['default'] = new_val
    target_reg['currentValue'] = new_val
    
    # Prepare payload
    payload = {
        "server": data['server'],
        "registers": data['registers']
    }
    
    print(f"2. Updating config with nominal={new_val}...")
    if put_config(payload, token):
        print("   Update success.")
    else:
        return False
        
    print("3. Checking registers.yaml file on disk...")
    time.sleep(2) # Give it a moment to write
    
    try:
        if not os.path.exists(CONFIG_FILE):
             print(f"   FAILED: {CONFIG_FILE} does not exist")
             return False

        with open(CONFIG_FILE, "r") as f:
            yaml_data = yaml.safe_load(f)
            
        # Find in yaml
        yaml_regs = yaml_data.get('registers', [])
        yaml_target = next((r for r in yaml_regs if r['address'] == 101), None)
        
        if not yaml_target:
            print("   FAILED: Register 101 not found in YAML")
            return False
            
        yaml_nominal = yaml_target.get('nominal')
        print(f"   YAML nominal value: {yaml_nominal}")
        
        if abs(float(yaml_nominal) - float(new_val)) < 0.1:
            print("   SUCCESS: YAML updated correctly!")
            return True
        else:
            print(f"   FAILED: YAML value {yaml_nominal} does not match expected {new_val}")
            return False
            
    except Exception as e:
        print(f"   FAILED to read/parse YAML: {e}")
        return False

if __name__ == "__main__":
    success = verify()
    sys.exit(0 if success else 1)
