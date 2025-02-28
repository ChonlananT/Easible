from flask import Flask
from flask_cors import CORS
from routes.api_routes import api_bp

app = Flask(__name__)
CORS(app)

# Register Blueprint
app.register_blueprint(api_bp)

if __name__ == '__main__':
    app.run(debug=True,host='0.0.0.0' , port=5000)
