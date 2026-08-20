import os
import sys

# Ensure backend directory is in python path
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.ai.waiting_time_model import waiting_time_predictor
from app.ai.noshow_model import noshow_predictor

def main():
    print("==========================================================")
    print("      AISCOS AI & MACHINE LEARNING PIPELINE TRAINING      ")
    print("==========================================================")
    
    print("\n[1/2] Training AI Waiting-Time Regressor (GradientBoosting vs Linear Regression)...")
    waiting_time_predictor.train()
    print("Evaluation Results:")
    print(f"  * Baseline Linear Regression: MAE = {waiting_time_predictor.metrics['baseline']['mae_minutes']} min, R2 = {waiting_time_predictor.metrics['baseline']['r2_score']}")
    print(f"  * Improved GBR Model:         MAE = {waiting_time_predictor.metrics['improved_model']['mae_minutes']} min, R2 = {waiting_time_predictor.metrics['improved_model']['r2_score']}")
    
    print("\n[2/2] Training AI Appointment No-Show Classifier (RandomForest vs Logistic Regression)...")
    noshow_predictor.train()
    print("Evaluation Results:")
    print(f"  * Baseline Logistic Regression: ROC-AUC = {noshow_predictor.metrics['baseline']['roc_auc']}, F1 = {noshow_predictor.metrics['baseline']['f1_score']}")
    print(f"  * Improved RandomForest Model:  ROC-AUC = {noshow_predictor.metrics['improved_model']['roc_auc']}, F1 = {noshow_predictor.metrics['improved_model']['f1_score']}")
    print(f"  * Confusion Matrix: {noshow_predictor.metrics['improved_model']['confusion_matrix']}")
    
    print("\n==========================================================")
    print("       ALL AI MODELS TRAINED AND ARTIFACTS SERIALIZED     ")
    print("==========================================================")

if __name__ == "__main__":
    main()
