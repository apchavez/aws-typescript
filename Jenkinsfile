// Jenkins Declarative Pipeline equivalent of .github/workflows/ci.yml.
// Kept alongside GitHub Actions (the CI actually enforced on this repo) to demonstrate
// Jenkinsfile/Groovy DSL fluency for orgs that run Jenkins on-prem instead of a SaaS CI.
pipeline {
    agent any

    tools {
        nodejs 'node20'
    }

    environment {
        SONAR_TOKEN = credentials('sonar-token')
    }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Trivy vulnerability scan') {
            steps {
                sh '''
                    trivy fs --scanners vuln --severity CRITICAL,HIGH \
                        --exit-code 1 --ignore-unfixed --format table .
                '''
            }
        }

        stage('Install dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Lint') {
            steps {
                sh 'npm run lint --if-present'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build --if-present'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Coverage') {
            steps {
                sh 'npm run test:coverage'
            }
        }

        stage('SonarCloud analysis') {
            when {
                branch 'main'
            }
            steps {
                withSonarQubeEnv('SonarCloud') {
                    sh 'npx --yes sonarqube-scanner'
                }
            }
        }
    }

    post {
        always {
            junit testResults: '**/junit.xml', allowEmptyResults: true
            archiveArtifacts artifacts: 'coverage/**', allowEmptyArchive: true
        }
    }
}
