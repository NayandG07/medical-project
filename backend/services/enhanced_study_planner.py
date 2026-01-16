"""
Enhanced Study Planner Service
Advanced study planning, scheduling, and AI recommendation capabilities
"""

from datetime import datetime, date, time, timedelta
from typing import List, Dict, Any, Optional
from supabase import Client
import logging
import json

logger = logging.getLogger(__name__)


class EnhancedStudyPlannerService:
    """Enhanced service for managing study plans with AI recommendations"""
    
    def __init__(self, supabase: Client):
        self.supabase = supabase
    
    # =========================================================================
    # STUDY PLAN ENTRIES
    # =========================================================================
    
    async def create_plan_entry(
        self,
        user_id: str,
        subject: str,
        study_type: str,
        scheduled_date: str,
        start_time: str,
        end_time: str,
        topic: Optional[str] = None,
        priority: str = "medium",
        notes: Optional[str] = None,
        tags: Optional[List[str]] = None,
        color_code: str = "#5C67F2",
        is_recurring: bool = False,
        recurrence_pattern: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new study plan entry"""
        try:
            entry_data = {
                "user_id": user_id,
                "subject": subject,
                "topic": topic,
                "study_type": study_type,
                "scheduled_date": scheduled_date,
                "start_time": start_time,
                "end_time": end_time,
                "priority": priority,
                "notes": notes,
                "tags": tags or [],
                "color_code": color_code,
                "is_recurring": is_recurring,
                "recurrence_pattern": recurrence_pattern
            }
            
            response = self.supabase.table("study_plan_entries").insert(entry_data).execute()
            
            if not response.data:
                raise Exception("Failed to create study plan entry")
            
            # Create recurring entries if applicable
            if is_recurring and recurrence_pattern:
                await self._create_recurring_entries(response.data[0], recurrence_pattern)
            
            return response.data[0]
            
        except Exception as e:
            logger.error(f"Failed to create plan entry: {str(e)}")
            raise
    
    async def get_plan_entries(
        self,
        user_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        status: Optional[str] = None,
        study_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get study plan entries with optional filters"""
        try:
            query = self.supabase.table("study_plan_entries").select("*").eq("user_id", user_id)
            
            if start_date:
                query = query.gte("scheduled_date", start_date)
            if end_date:
                query = query.lte("scheduled_date", end_date)
            if status:
                query = query.eq("status", status)
            if study_type:
                query = query.eq("study_type", study_type)
            
            query = query.order("scheduled_date").order("start_time")
            response = query.execute()
            
            return response.data or []
            
        except Exception as e:
            logger.error(f"Failed to get plan entries: {str(e)}")
            raise
    
    async def get_daily_entries(self, user_id: str, target_date: str) -> List[Dict[str, Any]]:
        """Get all entries for a specific day"""
        return await self.get_plan_entries(user_id, start_date=target_date, end_date=target_date)
    
    async def get_weekly_entries(self, user_id: str, week_start: str) -> List[Dict[str, Any]]:
        """Get all entries for a week starting from week_start"""
        try:
            start_date = datetime.strptime(week_start, "%Y-%m-%d")
            end_date = start_date + timedelta(days=6)
            return await self.get_plan_entries(
                user_id,
                start_date=week_start,
                end_date=end_date.strftime("%Y-%m-%d")
            )
        except Exception as e:
            logger.error(f"Failed to get weekly entries: {str(e)}")
            raise
    
    async def get_monthly_entries(self, user_id: str, year: int, month: int) -> List[Dict[str, Any]]:
        """Get all entries for a specific month"""
        try:
            start_date = date(year, month, 1)
            if month == 12:
                end_date = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = date(year, month + 1, 1) - timedelta(days=1)
            
            return await self.get_plan_entries(
                user_id,
                start_date=start_date.strftime("%Y-%m-%d"),
                end_date=end_date.strftime("%Y-%m-%d")
            )
        except Exception as e:
            logger.error(f"Failed to get monthly entries: {str(e)}")
            raise
    
    async def update_plan_entry(
        self,
        user_id: str,
        entry_id: str,
        updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update a study plan entry"""
        try:
            # Verify ownership
            existing = self.supabase.table("study_plan_entries").select("*").eq("id", entry_id).eq("user_id", user_id).execute()
            
            if not existing.data:
                raise Exception("Entry not found or access denied")
            
            response = self.supabase.table("study_plan_entries").update(updates).eq("id", entry_id).execute()
            
            if not response.data:
                raise Exception("Failed to update entry")
            
            return response.data[0]
            
        except Exception as e:
            logger.error(f"Failed to update plan entry: {str(e)}")
            raise
    
    async def complete_entry(
        self,
        user_id: str,
        entry_id: str,
        performance_score: Optional[int] = None,
        accuracy_percentage: Optional[float] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Mark a study plan entry as completed"""
        try:
            updates = {
                "status": "completed",
                "completion_percentage": 100,
                "completed_at": datetime.now().isoformat()
            }
            
            if performance_score is not None:
                updates["performance_score"] = performance_score
            if accuracy_percentage is not None:
                updates["accuracy_percentage"] = accuracy_percentage
            if notes:
                updates["notes"] = notes
            
            result = await self.update_plan_entry(user_id, entry_id, updates)
            
            # Update performance metrics
            await self._update_performance_metrics(user_id, result)
            
            # Update streak
            await self._update_streak(user_id)
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to complete entry: {str(e)}")
            raise
    
    async def start_entry(self, user_id: str, entry_id: str) -> Dict[str, Any]:
        """Mark a study plan entry as in progress"""
        try:
            updates = {
                "status": "in_progress",
                "started_at": datetime.now().isoformat()
            }
            return await self.update_plan_entry(user_id, entry_id, updates)
        except Exception as e:
            logger.error(f"Failed to start entry: {str(e)}")
            raise
    
    async def skip_entry(self, user_id: str, entry_id: str, reason: Optional[str] = None) -> Dict[str, Any]:
        """Mark a study plan entry as skipped"""
        try:
            updates = {
                "status": "skipped"
            }
            if reason:
                updates["notes"] = reason
            return await self.update_plan_entry(user_id, entry_id, updates)
        except Exception as e:
            logger.error(f"Failed to skip entry: {str(e)}")
            raise
    
    async def delete_plan_entry(self, user_id: str, entry_id: str) -> bool:
        """Delete a study plan entry"""
        try:
            response = self.supabase.table("study_plan_entries").delete().eq("id", entry_id).eq("user_id", user_id).execute()
            return True
        except Exception as e:
            logger.error(f"Failed to delete plan entry: {str(e)}")
            raise
    
    async def reschedule_entry(
        self,
        user_id: str,
        entry_id: str,
        new_date: str,
        new_start_time: str,
        new_end_time: str,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Reschedule a study plan entry to a new date/time"""
        try:
            # Get original entry
            existing = self.supabase.table("study_plan_entries").select("*").eq("id", entry_id).eq("user_id", user_id).execute()
            
            if not existing.data:
                raise Exception("Entry not found or access denied")
            
            original = existing.data[0]
            
            updates = {
                "scheduled_date": new_date,
                "start_time": new_start_time,
                "end_time": new_end_time,
                "status": "rescheduled" if original["status"] == "planned" else original["status"],
                "original_scheduled_date": original["scheduled_date"],
                "reschedule_reason": reason
            }
            
            return await self.update_plan_entry(user_id, entry_id, updates)
            
        except Exception as e:
            logger.error(f"Failed to reschedule entry: {str(e)}")
            raise
    
    # =========================================================================
    # STUDY GOALS
    # =========================================================================
    
    async def create_goal(
        self,
        user_id: str,
        title: str,
        goal_type: str,
        start_date: str,
        end_date: str,
        target_hours: Optional[float] = None,
        target_sessions: Optional[int] = None,
        target_topics: Optional[int] = None,
        target_accuracy: Optional[float] = None,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new study goal"""
        try:
            goal_data = {
                "user_id": user_id,
                "title": title,
                "description": description,
                "goal_type": goal_type,
                "target_hours": target_hours,
                "target_sessions": target_sessions,
                "target_topics": target_topics,
                "target_accuracy": target_accuracy,
                "start_date": start_date,
                "end_date": end_date
            }
            
            response = self.supabase.table("study_goals").insert(goal_data).execute()
            
            if not response.data:
                raise Exception("Failed to create goal")
            
            return response.data[0]
            
        except Exception as e:
            logger.error(f"Failed to create goal: {str(e)}")
            raise
    
    async def get_goals(
        self,
        user_id: str,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get user's study goals"""
        try:
            query = self.supabase.table("study_goals").select("*").eq("user_id", user_id)
            
            if status:
                query = query.eq("status", status)
            
            query = query.order("end_date", desc=False)
            response = query.execute()
            
            return response.data or []
            
        except Exception as e:
            logger.error(f"Failed to get goals: {str(e)}")
            raise
    
    async def update_goal(self, user_id: str, goal_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update a study goal"""
        try:
            response = self.supabase.table("study_goals").update(updates).eq("id", goal_id).eq("user_id", user_id).execute()
            
            if not response.data:
                raise Exception("Goal not found or access denied")
            
            return response.data[0]
        except Exception as e:
            logger.error(f"Failed to update goal: {str(e)}")
            raise
    
    async def delete_goal(self, user_id: str, goal_id: str) -> bool:
        """Delete a study goal"""
        try:
            self.supabase.table("study_goals").delete().eq("id", goal_id).eq("user_id", user_id).execute()
            return True
        except Exception as e:
            logger.error(f"Failed to delete goal: {str(e)}")
            raise
    
    # =========================================================================
    # PERFORMANCE & ANALYTICS
    # =========================================================================
    
    async def get_performance_metrics(
        self,
        user_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get performance metrics for a date range"""
        try:
            query = self.supabase.table("performance_metrics").select("*").eq("user_id", user_id)
            
            if start_date:
                query = query.gte("metric_date", start_date)
            if end_date:
                query = query.lte("metric_date", end_date)
            
            query = query.order("metric_date", desc=True)
            response = query.execute()
            
            return response.data or []
            
        except Exception as e:
            logger.error(f"Failed to get performance metrics: {str(e)}")
            raise
    
    async def get_performance_summary(self, user_id: str, days: int = 30) -> Dict[str, Any]:
        """Get a summary of user's performance"""
        try:
            start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
            metrics = await self.get_performance_metrics(user_id, start_date=start_date)
            
            if not metrics:
                return {
                    "total_study_hours": 0,
                    "average_accuracy": 0,
                    "sessions_completed": 0,
                    "consistency_score": 0,
                    "trend": "neutral",
                    "days_studied": 0
                }
            
            total_minutes = sum(m.get("total_study_minutes", 0) or 0 for m in metrics)
            sessions_completed = sum(m.get("sessions_completed", 0) or 0 for m in metrics)
            
            accuracies = [m.get("average_accuracy", 0) for m in metrics if m.get("average_accuracy")]
            avg_accuracy = sum(accuracies) / len(accuracies) if accuracies else 0
            
            # Calculate consistency
            days_studied = len([m for m in metrics if (m.get("total_study_minutes", 0) or 0) > 0])
            consistency = (days_studied / days) * 100
            
            # Calculate trend
            last_7 = metrics[:7] if len(metrics) >= 7 else metrics
            prev_7 = metrics[7:14] if len(metrics) >= 14 else []
            
            last_7_avg = sum(m.get("average_accuracy", 0) or 0 for m in last_7) / len(last_7) if last_7 else 0
            prev_7_avg = sum(m.get("average_accuracy", 0) or 0 for m in prev_7) / len(prev_7) if prev_7 else 0
            
            trend = "improving" if last_7_avg > prev_7_avg else ("declining" if last_7_avg < prev_7_avg else "stable")
            
            return {
                "total_study_hours": round(total_minutes / 60, 1),
                "average_accuracy": round(avg_accuracy, 1),
                "sessions_completed": sessions_completed,
                "consistency_score": round(consistency, 1),
                "trend": trend,
                "days_studied": days_studied
            }
            
        except Exception as e:
            logger.error(f"Failed to get performance summary: {str(e)}")
            raise
    
    async def get_subject_breakdown(self, user_id: str, days: int = 30) -> List[Dict[str, Any]]:
        """Get study time breakdown by subject"""
        try:
            start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
            entries = await self.get_plan_entries(user_id, start_date=start_date, status="completed")
            
            subject_data = {}
            for entry in entries:
                subject = entry.get("subject", "Unknown")
                duration = entry.get("duration_minutes", 0) or 0
                accuracy = entry.get("accuracy_percentage")
                
                if subject not in subject_data:
                    subject_data[subject] = {"total_minutes": 0, "sessions": 0, "accuracies": []}
                
                subject_data[subject]["total_minutes"] += duration
                subject_data[subject]["sessions"] += 1
                if accuracy:
                    subject_data[subject]["accuracies"].append(accuracy)
            
            result = []
            for subject, data in subject_data.items():
                avg_accuracy = sum(data["accuracies"]) / len(data["accuracies"]) if data["accuracies"] else None
                result.append({
                    "subject": subject,
                    "total_hours": round(data["total_minutes"] / 60, 1),
                    "sessions": data["sessions"],
                    "average_accuracy": round(avg_accuracy, 1) if avg_accuracy else None
                })
            
            result.sort(key=lambda x: x["total_hours"], reverse=True)
            return result
            
        except Exception as e:
            logger.error(f"Failed to get subject breakdown: {str(e)}")
            raise
    
    # =========================================================================
    # STREAKS
    # =========================================================================
    
    async def get_streak(self, user_id: str) -> Dict[str, Any]:
        """Get user's current streak data"""
        try:
            response = self.supabase.table("study_streaks").select("*").eq("user_id", user_id).execute()
            
            if response.data:
                return response.data[0]
            
            # Create initial streak record if doesn't exist
            new_streak = {
                "user_id": user_id,
                "current_streak": 0,
                "longest_streak": 0,
                "days_studied_this_week": 0,
                "days_studied_this_month": 0
            }
            
            create_response = self.supabase.table("study_streaks").insert(new_streak).execute()
            return create_response.data[0] if create_response.data else new_streak
            
        except Exception as e:
            logger.error(f"Failed to get streak: {str(e)}")
            raise
    
    async def _update_streak(self, user_id: str) -> Dict[str, Any]:
        """Update user's streak after completing a session"""
        try:
            streak = await self.get_streak(user_id)
            today = date.today()
            
            last_study_date = streak.get("last_study_date")
            if last_study_date:
                last_study = datetime.strptime(last_study_date, "%Y-%m-%d").date()
                days_diff = (today - last_study).days
                
                if days_diff == 0:
                    return streak
                elif days_diff == 1:
                    new_streak = streak["current_streak"] + 1
                else:
                    new_streak = 1
            else:
                new_streak = 1
            
            updates = {
                "current_streak": new_streak,
                "longest_streak": max(new_streak, streak.get("longest_streak", 0)),
                "last_study_date": today.isoformat(),
                "streak_start_date": streak.get("streak_start_date") or today.isoformat(),
                "days_studied_this_week": min(streak.get("days_studied_this_week", 0) + 1, 7),
                "days_studied_this_month": min(streak.get("days_studied_this_month", 0) + 1, 31)
            }
            
            response = self.supabase.table("study_streaks").update(updates).eq("user_id", user_id).execute()
            return response.data[0] if response.data else streak
            
        except Exception as e:
            logger.error(f"Failed to update streak: {str(e)}")
            raise
    
    # =========================================================================
    # AI RECOMMENDATIONS
    # =========================================================================
    
    async def generate_recommendations(self, user_id: str) -> List[Dict[str, Any]]:
        """Generate AI-powered study recommendations"""
        try:
            recommendations = []
            summary = await self.get_performance_summary(user_id)
            
            # Get recent data
            week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
            recent_entries = await self.get_plan_entries(user_id, start_date=week_ago, status="completed")
            
            # Optimal study time recommendation
            recommendations.append({
                "recommendation_type": "optimal_time",
                "title": "Optimal Study Time",
                "description": "Based on typical performance patterns, morning hours (9 AM - 12 PM) tend to yield best results. Schedule important topics during this time.",
                "suggested_start_time": "09:00",
                "confidence_score": 75,
                "reasoning": "General performance patterns"
            })
            
            # Weak topic recommendations based on accuracy
            subject_data = {}
            for entry in recent_entries:
                subject = entry.get("subject")
                accuracy = entry.get("accuracy_percentage")
                if subject and accuracy:
                    if subject not in subject_data:
                        subject_data[subject] = []
                    subject_data[subject].append(accuracy)
            
            for subject, accuracies in subject_data.items():
                avg = sum(accuracies) / len(accuracies)
                if avg < 70:
                    recommendations.append({
                        "recommendation_type": "weak_topic",
                        "title": f"Focus on {subject}",
                        "description": f"Your accuracy in {subject} is {round(avg)}%. Consider scheduling extra revision sessions.",
                        "suggested_subject": subject,
                        "suggested_study_type": "revision",
                        "suggested_duration_minutes": 45,
                        "confidence_score": 85,
                        "reasoning": "Accuracy below target threshold"
                    })
            
            # Consistency recommendation
            if summary.get("consistency_score", 0) < 60:
                recommendations.append({
                    "recommendation_type": "goal_adjustment",
                    "title": "Improve Study Consistency",
                    "description": "Try setting smaller daily goals to build a consistent study habit.",
                    "confidence_score": 75,
                    "reasoning": "Consistency score below optimal threshold"
                })
            
            # Break recommendation
            if summary.get("total_study_hours", 0) > 35:
                recommendations.append({
                    "recommendation_type": "break",
                    "title": "Consider Taking a Break",
                    "description": "You've been studying intensively. A short break can help consolidate learning.",
                    "confidence_score": 90,
                    "reasoning": "Detected high study hours pattern"
                })
            
            return recommendations[:5]  # Return top 5 recommendations
            
        except Exception as e:
            logger.error(f"Failed to generate recommendations: {str(e)}")
            raise
    
    # =========================================================================
    # DAILY BRIEF
    # =========================================================================
    
    async def get_daily_brief(self, user_id: str) -> Dict[str, Any]:
        """Generate a daily study brief for the user"""
        try:
            today = date.today().isoformat()
            
            # Get today's entries
            today_entries = await self.get_daily_entries(user_id, today)
            
            # Get streak
            streak = await self.get_streak(user_id)
            
            # Get active goals
            goals = await self.get_goals(user_id, status="active")
            
            # Get recommendations
            recommendations = await self.generate_recommendations(user_id)
            
            # Calculate planned hours
            total_planned_minutes = 0
            for entry in today_entries:
                if entry.get("start_time") and entry.get("end_time"):
                    try:
                        start = datetime.strptime(entry["start_time"], "%H:%M:%S" if len(entry["start_time"]) > 5 else "%H:%M")
                        end = datetime.strptime(entry["end_time"], "%H:%M:%S" if len(entry["end_time"]) > 5 else "%H:%M")
                        total_planned_minutes += (end - start).seconds // 60
                    except:
                        pass
            
            high_priority = [e for e in today_entries if e.get("priority") in ["high", "critical"]]
            
            # Get greeting
            hour = datetime.now().hour
            if hour < 12:
                greeting = "Good morning"
            elif hour < 17:
                greeting = "Good afternoon"
            else:
                greeting = "Good evening"
            
            return {
                "date": today,
                "greeting": greeting,
                "streak": {
                    "current": streak.get("current_streak", 0),
                    "longest": streak.get("longest_streak", 0)
                },
                "today": {
                    "total_sessions": len(today_entries),
                    "planned_hours": round(total_planned_minutes / 60, 1),
                    "high_priority_count": len(high_priority),
                    "sessions": today_entries[:5]
                },
                "active_goals": len(goals),
                "top_recommendation": recommendations[0] if recommendations else None
            }
            
        except Exception as e:
            logger.error(f"Failed to get daily brief: {str(e)}")
            raise
    
    # =========================================================================
    # HELPER METHODS
    # =========================================================================
    
    async def _update_performance_metrics(self, user_id: str, completed_entry: Dict[str, Any]):
        """Update performance metrics after completing a session"""
        try:
            today = date.today().isoformat()
            
            response = self.supabase.table("performance_metrics").select("*").eq("user_id", user_id).eq("metric_date", today).execute()
            
            # Calculate duration
            duration = 0
            if completed_entry.get("start_time") and completed_entry.get("end_time"):
                try:
                    start = datetime.strptime(completed_entry["start_time"], "%H:%M:%S" if len(completed_entry["start_time"]) > 5 else "%H:%M")
                    end = datetime.strptime(completed_entry["end_time"], "%H:%M:%S" if len(completed_entry["end_time"]) > 5 else "%H:%M")
                    duration = (end - start).seconds // 60
                except:
                    pass
            
            if response.data:
                metrics = response.data[0]
                updates = {
                    "total_study_minutes": (metrics.get("total_study_minutes", 0) or 0) + duration,
                    "sessions_completed": (metrics.get("sessions_completed", 0) or 0) + 1,
                    "is_streak_day": True
                }
                
                if completed_entry.get("accuracy_percentage"):
                    old_avg = metrics.get("average_accuracy", 0) or 0
                    old_count = metrics.get("sessions_completed", 0) or 0
                    new_accuracy = completed_entry["accuracy_percentage"]
                    updates["average_accuracy"] = ((old_avg * old_count) + new_accuracy) / (old_count + 1)
                
                self.supabase.table("performance_metrics").update(updates).eq("id", metrics["id"]).execute()
            else:
                new_metrics = {
                    "user_id": user_id,
                    "metric_date": today,
                    "total_study_minutes": duration,
                    "sessions_completed": 1,
                    "is_streak_day": True,
                    "average_accuracy": completed_entry.get("accuracy_percentage"),
                    "topics_covered": [completed_entry.get("subject")] if completed_entry.get("subject") else []
                }
                self.supabase.table("performance_metrics").insert(new_metrics).execute()
                
        except Exception as e:
            logger.error(f"Failed to update performance metrics: {str(e)}")
    
    async def _create_recurring_entries(self, parent_entry: Dict[str, Any], pattern: str):
        """Create recurring entries based on pattern"""
        try:
            start_date = datetime.strptime(parent_entry["scheduled_date"], "%Y-%m-%d")
            intervals = {"daily": 1, "weekly": 7, "biweekly": 14, "monthly": 30}
            interval = intervals.get(pattern, 7)
            
            for i in range(1, 5):
                next_date = start_date + timedelta(days=interval * i)
                entry_data = {
                    "user_id": parent_entry["user_id"],
                    "subject": parent_entry["subject"],
                    "topic": parent_entry.get("topic"),
                    "study_type": parent_entry["study_type"],
                    "scheduled_date": next_date.strftime("%Y-%m-%d"),
                    "start_time": parent_entry["start_time"],
                    "end_time": parent_entry["end_time"],
                    "priority": parent_entry["priority"],
                    "notes": parent_entry.get("notes"),
                    "tags": parent_entry.get("tags", []),
                    "color_code": parent_entry.get("color_code", "#5C67F2"),
                    "is_recurring": True,
                    "recurrence_pattern": pattern,
                    "parent_entry_id": parent_entry["id"]
                }
                self.supabase.table("study_plan_entries").insert(entry_data).execute()
        except Exception as e:
            logger.error(f"Failed to create recurring entries: {str(e)}")


# Factory function
_enhanced_planner_service = None

def get_enhanced_study_planner_service(supabase: Client) -> EnhancedStudyPlannerService:
    """Get or create enhanced study planner service instance"""
    global _enhanced_planner_service
    if _enhanced_planner_service is None:
        _enhanced_planner_service = EnhancedStudyPlannerService(supabase)
    return _enhanced_planner_service
