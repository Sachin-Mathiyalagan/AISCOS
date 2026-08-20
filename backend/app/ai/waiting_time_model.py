import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from app.core.config import settings

class WaitingTimePredictor:
    def __init__(self):
        self.model_path = os.path.join(settings.AI_MODELS_DIR, "waiting_time_gbr.joblib")
        self.model = None
        self.metrics = {}
        self.load_or_train()

    def generate_synthetic_dataset(self, n_samples: int = 2500) -> pd.DataFrame:
        np.random.seed(42)
        
        # Features:
        # 1. queue_length_ahead (0 to 15)
        # 2. doctor_avg_duration_min (8 to 25 mins)
        # 3. current_consultation_elapsed (0 to 20 mins)
        # 4. hour_of_day (8 to 19)
        # 5. day_of_week (0 to 6)
        # 6. patient_acuity_score (1 to 4: 1=Emergency, 2=Emergent, 3=Urgent, 4=Routine)
        # 7. delayed_appointments_count (0 to 5)
        
        queue_len = np.random.randint(0, 16, n_samples)
        doc_avg = np.random.uniform(10.0, 22.0, n_samples)
        elapsed = np.random.uniform(0.0, 15.0, n_samples)
        hour = np.random.randint(8, 20, n_samples)
        dow = np.random.randint(0, 7, n_samples)
        acuity = np.random.choice([1, 2, 3, 4], size=n_samples, p=[0.05, 0.15, 0.35, 0.45])
        delayed = np.random.poisson(lam=1.2, size=n_samples)
        
        # Ground truth physics with non-linear clinical dynamics:
        # Base wait = (queue_len * doc_avg) - elapsed
        # Peak hours (10-12 and 16-18) add congestion delay
        # Acute triage cases jump queue (shorter wait)
        # Random clinic variance / noise (sigma = 2.5 mins)
        
        peak_multiplier = np.where(((hour >= 10) & (hour <= 12)) | ((hour >= 16) & (hour <= 18)), 1.25, 1.0)
        acuity_adjustment = np.where(acuity == 1, 0.05, np.where(acuity == 2, 0.35, np.where(acuity == 3, 0.8, 1.1)))
        
        base_wait = (queue_len * doc_avg * acuity_adjustment * peak_multiplier) + (delayed * 4.5) - (elapsed * 0.5)
        noise = np.random.normal(0, 2.5, n_samples)
        target_wait = np.clip(base_wait + noise, a_min=1.0, a_max=180.0)
        
        df = pd.DataFrame({
            "queue_length_ahead": queue_len,
            "doctor_avg_duration_min": doc_avg,
            "current_consultation_elapsed": elapsed,
            "hour_of_day": hour,
            "day_of_week": dow,
            "patient_acuity_score": acuity,
            "delayed_appointments_count": delayed,
            "actual_wait_minutes": target_wait
        })
        return df

    def train(self):
        os.makedirs(settings.AI_MODELS_DIR, exist_ok=True)
        df = self.generate_synthetic_dataset()
        
        feature_cols = [
            "queue_length_ahead",
            "doctor_avg_duration_min",
            "current_consultation_elapsed",
            "hour_of_day",
            "day_of_week",
            "patient_acuity_score",
            "delayed_appointments_count"
        ]
        
        X = df[feature_cols]
        y = df["actual_wait_minutes"]
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Baseline: Linear Regression
        lr = LinearRegression()
        lr.fit(X_train, y_train)
        lr_pred = lr.predict(X_test)
        lr_mae = mean_absolute_error(y_test, lr_pred)
        lr_rmse = np.sqrt(mean_squared_error(y_test, lr_pred))
        lr_r2 = r2_score(y_test, lr_pred)
        
        # Proposed: Gradient Boosting Regressor
        gbr = GradientBoostingRegressor(
            n_estimators=150,
            learning_rate=0.08,
            max_depth=4,
            random_state=42
        )
        gbr.fit(X_train, y_train)
        gbr_pred = gbr.predict(X_test)
        gbr_mae = mean_absolute_error(y_test, gbr_pred)
        gbr_rmse = np.sqrt(mean_squared_error(y_test, gbr_pred))
        gbr_r2 = r2_score(y_test, gbr_pred)
        
        self.model = gbr
        self.metrics = {
            "model_type": "GradientBoostingRegressor",
            "baseline": {
                "model": "LinearRegression",
                "mae_minutes": round(float(lr_mae), 2),
                "rmse_minutes": round(float(lr_rmse), 2),
                "r2_score": round(float(lr_r2), 3)
            },
            "improved_model": {
                "model": "GradientBoostingRegressor",
                "mae_minutes": round(float(gbr_mae), 2),
                "rmse_minutes": round(float(gbr_rmse), 2),
                "r2_score": round(float(gbr_r2), 3)
            },
            "training_samples": len(df),
            "test_samples": len(X_test)
        }
        
        # Save model and metrics
        joblib.dump({"model": self.model, "metrics": self.metrics}, self.model_path)
        print(f"[AI PIPELINE] Waiting-Time Regressor trained successfully. GBR MAE: {gbr_mae:.2f} mins (R²: {gbr_r2:.3f}) vs Baseline MAE: {lr_mae:.2f} mins.")

    def load_or_train(self):
        if os.path.exists(self.model_path):
            try:
                data = joblib.load(self.model_path)
                self.model = data["model"]
                self.metrics = data["metrics"]
                return
            except Exception:
                pass
        self.train()

    def predict(
        self,
        queue_length_ahead: int,
        doctor_avg_duration_min: float = 15.0,
        current_consultation_elapsed: float = 5.0,
        hour_of_day: int = 10,
        day_of_week: int = 1,
        patient_acuity_score: int = 4,
        delayed_appointments_count: int = 0
    ) -> dict:
        if self.model is None:
            self.load_or_train()
            
        features = np.array([[
            queue_length_ahead,
            doctor_avg_duration_min,
            current_consultation_elapsed,
            hour_of_day,
            day_of_week,
            patient_acuity_score,
            delayed_appointments_count
        ]])
        
        predicted_minutes = float(self.model.predict(features)[0])
        predicted_minutes = max(1.0, round(predicted_minutes, 1))
        
        # Calculate 90% confidence interval based on RMSE
        rmse = self.metrics.get("improved_model", {}).get("rmse_minutes", 3.5)
        interval_delta = round(1.645 * rmse, 1)
        
        min_wait = max(1, int(round(predicted_minutes - interval_delta)))
        max_wait = int(round(predicted_minutes + interval_delta))
        
        return {
            "predicted_wait_minutes": int(round(predicted_minutes)),
            "confidence_interval": {
                "min_minutes": min_wait,
                "max_minutes": max_wait
            },
            "model_metadata": {
                "mae": self.metrics.get("improved_model", {}).get("mae_minutes", 3.1),
                "r2_score": self.metrics.get("improved_model", {}).get("r2_score", 0.91)
            }
        }

waiting_time_predictor = WaitingTimePredictor()
