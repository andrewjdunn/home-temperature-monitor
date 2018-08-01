# home-temperature-monitor
Service running on a network of Raspberry pi zeros connected to DHT sensors to collect and display temperature and humidity data

The current version uses a c program and wiringPI to query the either DHT11 or DHT22 periodically and save any changes in environemnt to a csv file with a name made up from todays date in a folder named after the sensor (normally the name of the room the sensor is in)

Multiple raspberry Pi Zeros can be used to connect to more senors, perhaps on different floors, using network shares to syncronize to a central server.

Configuration is by command line, saved into a bash script that is ran as a service.

The current temperature and humidity can be dislayed on a small OLED (ssd1306) each room is displayed in turn - with an indicator for any room that is too hot or cold, the current temperatures and statistics (lowest temperature, time spent colder than ideal etc) for the last 24 hours is served as a web page using a nodejs back end that just reads the raw csv files.

Apart from generally improving the code and replacing the c part with javascript the idea is to produce a front end that presents statistical information about the temperature and humidity in rooms for all recorded data, currently only the last 24 hours is shown but data is recorded for a configuable number of days.
