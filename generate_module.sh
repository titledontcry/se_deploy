#!/bin/bash

modules=(
appointments
assessment
assessment_answer
assessment_score_band
child
child_assessment
child_parent
choice
diagnose
dispense
drug
invoice
invoice_item
notifications
parent
payment
prescription
prescription_item
question
roles
room
staff
treatment_plan
user_roles
users
visit
vital_signs
work_schedules
)

for module in "${modules[@]}"
do
  nest g module $module
  nest g controller $module
  nest g service $module
done