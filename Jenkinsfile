pipeline {
    agent { label 'deploy' }
    

    environment {
        SONARQUBE = credentials('sonar-token')
        SCANNER_HOME = tool 'SonarScanner'
        BUCKET_NAME = 'trivy-logs-forcastify'
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
        stage('Trivy Security Scan') {
            steps {
                sh '''
                trivy fs --severity HIGH,CRITICAL --skip-files .env --skip-files env.txt --exit-code 1 --no-progress .
                '''
            }
        }

        stage('Trivy Scan Report') {
            steps {
                sh '''
                curl -sLO https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/html.tpl
                trivy fs --format template --template "@html.tpl" -o trivy-report.html --skip-files .env --skip-files env.txt .
                '''
            }
        }

        stage('Upload to S3') {
            steps {
                sh '''
                aws s3 cp trivy-report.html s3://$BUCKET_NAME/trivy-report-${BUILD_NUMBER}.html
                '''
            }
        }

        stage('Inject Env File') {
            steps {
                withCredentials([file(credentialsId: 'env-file', variable: 'ENV_FILE')]) {
                    sh '''
                    rm -f .env
                    cp $ENV_FILE .env
                    '''
                }
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
                sh 'docker-compose down || true'
                sh 'docker-compose up -d'
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'trivy-report.html', fingerprint: true
        }
        success {
            echo '✅ Pipeline completed successfully!'
        }
        failure {
            echo '❌ Pipeline failed!'
        }
    }
}
