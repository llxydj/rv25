@echo off

set API_KEY=555786d4af9d70f819b1e03e738c3d5e76e3de0d

set MESSAGE=%5BRVOIS+System+Alert%5D%0ADear+Customer,%0AYour+reward+points+have+been+updated+successfully.%0AThank+you+for+using+our+services!

rem === List of recipient numbers ===

set NUMBERS=09858535660 09683653434

echo Sending SMS to multiple recipients...

for %%N in (%NUMBERS%) do (

    echo Sending to %%N ...

    curl -X POST "https://sms.iprogtech.com/api/v1/sms_messages?api_token=%API_KEY%&message=%MESSAGE%&phone_number=%%N"

)

echo All messages sent!

pause

