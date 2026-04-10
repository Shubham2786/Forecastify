pipeline {
    agent { label 'deploy' }

    environment {
        SONARQUBE = credentials('sonar-token')
        SCANNER_HOME = tool 'SonarScanner'
    }

    stages {

        stage('Pull OR Clone the Code') {
            steps {
                git branch: 'main', url: 'https://github.com/Darshan1814/Forecastify'
            }
        }

        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh '''
                    ${SCANNER_HOME}/bin/sonar-scanner \
                    -Dsonar.projectKey=forecastify \
                    -Dsonar.sources=. \
                    -Dsonar.host.url=http://13.234.152.9:9000 \
                    '''
                }
            }
        }

        stage('Inject Env File') {
            steps {
                withCredentials([file(credentialsId: 'env-file', variable: 'ENV_FILE')]) {
                    sh '''
                    cp $ENV_FILE .env
                    '''
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Build Application') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Docker Build') {
            steps {
                sh 'docker build -t forecastify .'
            }
        }

        stage('Push to DockerHub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh '''
                    echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin
                    docker tag forecastify $DOCKER_USER/forecastify:latest
                    docker push $DOCKER_USER/forecastify:latest
                    '''
                }
            }
        }

        stage('Deploy') {
            steps {
                sh 'docker compose down || true'
                sh 'docker compose up -d'
            }
        }
    }

    post {
        success {
            echo '✅ Pipeline completed successfully!'
        }
        failure {
            echo '❌ Pipeline failed!'
        }
    }
}
