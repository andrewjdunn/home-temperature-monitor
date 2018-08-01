#include <wiringPi.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <time.h>
#include <string.h>
#include <unistd.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/dir.h>
#include <dirent.h>
#include <fcntl.h>

#define MAXTIMINGS	85
#define MAX_PINS	17
#define POLLING_PERIOD_SECONDS	3

// Constant strings
const char* time_format = "%T";
const char* filename_prefix_format = "%d%m%Y";
const char* filename_format = "%s.csv";

// Sensor Configuration
//https://othermod.com/wp-content/uploads/Raspberry-Pi-Model-Zero-Mini-PC.jpg + https://pinout.xyz/
char* names[MAX_PINS];
int pins[MAX_PINS];
int type_is_dht22[MAX_PINS];


// Global Settings
int write_to_console = 1;
int write_to_file = 1;
int days_to_keep_old_files = 365;
char* server_path = "server/sensors";
char* local_path = "local";

// Per sensor Buffers
float temperature[MAX_PINS];
float relative_humidity[MAX_PINS];
float last_written_temperature[MAX_PINS];
float last_written_relative_humidity[MAX_PINS];
int todays_server_file_syncd[MAX_PINS];

// Global buffers
time_t now;
char time_str_buffer[9] = "";
char filename_prefix_buffer[9];
char filename_buffer[13];
char data_buffer[100] = "";
char server_file_path_buffer[200] = "";
char local_file_path_buffer[200] = "";
char copy_buffer[1024];

void copy_file(char *source, char *destination)
{
	int source_handle = open(source,O_RDONLY);
	int destination_handle = open(destination,O_WRONLY | O_CREAT,  S_IRUSR | S_IWUSR);
	if(source_handle != -1 && destination_handle != -1)
	{
		ssize_t count;
		while( (count = read(source_handle,copy_buffer,sizeof(copy_buffer))))
		{
			write(destination_handle,copy_buffer,count);
		}
	}
	else
	{
		printf("Could not open files for copy source %d destination %d\n",source_handle, destination_handle);
	}

	if(source_handle!=-1)
	{
		close(source_handle);
	}

	if(destination_handle!=-1)
	{
		close(destination_handle);
	}

}

char * get_filename_for_tm(struct tm * timeptr)
{
	strftime(filename_prefix_buffer, 9, filename_prefix_format, timeptr);
	sprintf(filename_buffer, filename_format,filename_prefix_buffer);
	return filename_buffer;
}

char * get_file_path_for_tm(struct tm * timeptr, int sensor_index)
{
	char* filename = get_filename_for_tm(timeptr);	
	sprintf(local_file_path_buffer, "%s/%s/%s",local_path, names[sensor_index],filename);
	return local_file_path_buffer;
}

int is_todays_file(char *file_name)
{
	time(&now);
    struct tm * timeptr = localtime(&now);
	return strstr(file_name, get_filename_for_tm(timeptr)) == file_name;
}

void add_record_to_file(char *file_name, char * record, int sensor_index)
{
	FILE *log_file = fopen(file_name,"a");
	if(log_file != NULL)
	{
		fwrite(record, 1, strlen(record), log_file);
		fclose(log_file);
	}
	else
	{
		printf("Could not open %s for appending\n",file_name);
		todays_server_file_syncd[sensor_index] = 0;
	}

}

void sync_current_file(char * record, int sensor_index)
{
	// Look for the todays file on the server - if not there - just coy the local over
	time(&now);
    struct tm * timeptr = localtime(&now);
	char *todays_file_name = get_file_path_for_tm(timeptr, sensor_index);

	sprintf(server_file_path_buffer,"%s/%s/%s",server_path, names[sensor_index], get_filename_for_tm(timeptr));
	int local_file_exists = access(todays_file_name, F_OK);
	int server_file_exists = access(server_file_path_buffer, F_OK);
	if(local_file_exists != -1)
	{
		if(server_file_exists == -1 || todays_server_file_syncd[sensor_index] == 0)
		{
			printf("Server file [%s] does not exist [%s] or needs syncing [%s] - copy the local [%s]\n", server_file_path_buffer, server_file_exists ? "true":"false", todays_server_file_syncd[sensor_index] ? "false" : "true", todays_file_name);
			copy_file(todays_file_name, server_file_path_buffer);
			// While running we  will keep the file in sync - unless we error - in which case reset the flag
			todays_server_file_syncd[sensor_index] = 1;
		}
		else
		{
			// Just add the new line
			add_record_to_file(server_file_path_buffer, record, sensor_index);
		}
	}
	else
	{
		printf("sync_current_file - local does not exist %s\n",todays_file_name);
	}
}

void sync_old_files(int sensor_index)
{
	// TODO: New thread - and lock something - critical section type thing
	DIR *d;
	struct dirent* dir;
	sprintf(local_file_path_buffer,"%s/%s",local_path, names[sensor_index]);
	d = opendir(local_file_path_buffer);
	if(d)
	{
		while((dir = readdir(d)) != NULL)
		{
			char* ext_ptr = strstr(dir->d_name,".csv");
                        // TODO: Formatting the date for every file is not efficient
			int is_todays = is_todays_file(dir->d_name);
			//printf("Syncing file %s is todays? %s is csv = %s\n",dir->d_name,is_todays?"true":"false", ext_ptr);
			if(ext_ptr != NULL && !is_todays)
			{
				sprintf(local_file_path_buffer,"%s/%s/%s",local_path, names[sensor_index],dir->d_name);
				// Look for this file on the server..
				sprintf(server_file_path_buffer,"%s/%s/%s",server_path, names[sensor_index], dir->d_name);
				if(access(server_file_path_buffer,F_OK)==-1)
				{
					printf("Need to sync %s to server as it does not exist there\n",server_file_path_buffer);
					copy_file(local_file_path_buffer,server_file_path_buffer);
				}
				else
				{
					// The file exist - if could be partially written - check the size mathes					
					struct stat local_stat;
					struct stat server_stat;
					stat(server_file_path_buffer, &server_stat);
					stat(local_file_path_buffer, &local_stat);
					if(server_stat.st_size != local_stat.st_size)
					{
						printf("%s found on the server %s - but the size is different - will copy again\n",local_file_path_buffer,server_file_path_buffer);
						copy_file(local_file_path_buffer,server_file_path_buffer);
						stat(server_file_path_buffer, &server_stat);
						stat(local_file_path_buffer, &local_stat);
						if(server_stat.st_size != local_stat.st_size)
						{
							printf("Sanity check failed after copy - still different sizes %s %d(server) != %d(local)\n",server_file_path_buffer, server_stat.st_size, local_stat.st_size);
						}

					}
					else
					{
						// File found on server more than likely a good copy - hold long has it been in the client?
						time(&now);
						struct tm * now_time = localtime(&now);
						time_t now_seconds = mktime(now_time);
						time_t seconds_since_file_modified = now_seconds - local_stat.st_mtim.tv_sec;
						long days_since_file_modified = seconds_since_file_modified / (24*60*60);
						if(days_since_file_modified >= days_to_keep_old_files)
						{
							//delete local copy
							printf(" Pretending Removing local copy of %s as it's %d days old\n", dir->d_name, days_since_file_modified);
							unlink(dir->d_name);
						}
					}
				}
			}
		}
		closedir(d);
	}
	else
	{
		printf("Could not opendir(%s)\n",local_file_path_buffer);
	}
}

void update_server(char *record, int sensor_index)
{
	printf("I'm updating the server...\n");
	sprintf(server_file_path_buffer,"%s/%s",server_path, names[sensor_index]);

	struct stat st = {0};

	if (stat(server_file_path_buffer,&st) == -1)
	{
	    printf("Creating a folder %s\n",server_file_path_buffer);
	    mkdir(server_file_path_buffer, 0700);
	}

	sync_old_files(sensor_index);
	sync_current_file(record, sensor_index);
}

int server_is_available()
{
	int server_connected = 0;
	if(strlen(server_path)>0)
	{
		// Check the server folder exists
		if(access(server_path, W_OK) != -1)
		{
			// Check that the folder is a mount point (the cheap way)
			struct stat local_stat,server_stat;
			stat(".",&local_stat);
			stat(server_path, &server_stat);
			if(local_stat.st_dev != server_stat.st_dev)
			{
				printf("%s is mounted\n",server_path);
				server_connected = 1;
			}
			else
			{
				printf("%s not mounted\n",server_path);
			}

		}
		else
		{
			printf("%s does not exist or no write permission\n",server_path);
		}
	}
	return server_connected;
}

void create_local_folder(int sensor_index)
{
	struct stat local_stat;
	if (stat(local_path,&local_stat) == -1)
	{
	    printf("Creating a local folder %s\n",local_path);
	    mkdir(local_path, 0700);
	}

	sprintf(local_file_path_buffer, "%s/%s",local_path, names[sensor_index]);
	if (stat(local_file_path_buffer,&local_stat) == -1)
	{
	    printf("Creating sensor %d folder %s\n", sensor_index, local_file_path_buffer);
	    mkdir(local_file_path_buffer, 0700);
	}
}

void record_to_file(int sensor_index)
{
	create_local_folder(sensor_index);
	time(&now);
	struct tm * timeptr = gmtime(&now);
	strftime(time_str_buffer, 9, time_format, timeptr);
	sprintf(data_buffer,"%s,%.1f,%.1f\n", time_str_buffer,relative_humidity[sensor_index], temperature[sensor_index]);
	char * file_name = get_file_path_for_tm(timeptr, sensor_index);

	add_record_to_file(file_name, data_buffer, sensor_index);

	last_written_temperature[sensor_index] = temperature[sensor_index];
	last_written_relative_humidity[sensor_index] = relative_humidity[sensor_index];
	if(server_is_available() == 1)
	{
		update_server(data_buffer, sensor_index);
	}
}

void write_to_stdout(int sensor_index)
{
	float f = temperature[sensor_index] * 9. / 5. + 32;
	printf( "Room = %s, Humidity = %.1f %% Temperature = %.1f C (%.1f F)\n",
			names[sensor_index], relative_humidity[sensor_index], temperature[sensor_index], f );
}

void read_dht11_dat(int sensor_index)
{
	uint8_t laststate	= HIGH;
	uint8_t counter		= 0;
	uint8_t j		= 0, i;
	float	f;

	int pin = pins[sensor_index];
	char *name = names[sensor_index];

	int dht_dat[5] = {0,0,0,0,0};

	pinMode( pin, OUTPUT );
	digitalWrite( pin, LOW );
	delay( 18 );
	digitalWrite( pin, HIGH );
	delayMicroseconds( 40 );
	pinMode( pin, INPUT );

	for ( i = 0; i < MAXTIMINGS; i++ )
	{
		counter = 0;
		while ( digitalRead( pin ) == laststate )
		{
			counter++;
			delayMicroseconds( 1 );
			if ( counter == 255 )
			{
				break;
			}
		}
		laststate = digitalRead( pin );

		if ( counter == 255 )
		{
			break;
		}

		if ( (i >= 4) && (i % 2 == 0) )
		{
			dht_dat[j / 8] <<= 1;
			if ( counter > 16 )
			{
				dht_dat[j / 8] |= 1;
			}
			j++;
		}
	}



	if ( (j >= 40) && (dht_dat[4] == ( (dht_dat[0] + dht_dat[1] + dht_dat[2] + dht_dat[3]) & 0xFF) ) )
	{
		printf("Raw data H %d %d T %d %d %d\n", dht_dat[0],dht_dat[1], dht_dat[2], dht_dat[3], type_is_dht22);
		if(type_is_dht22[sensor_index] == 1)
		{
			relative_humidity[sensor_index] = (float)((dht_dat[0] << 8) | dht_dat[1])/10.0;
			temperature[sensor_index] = (float)((dht_dat[2] << 8) | dht_dat[3])/10.0;
		}
		else
		{
			relative_humidity[sensor_index] = dht_dat[0] + ((float)dht_dat[1]/10.0);
			temperature[sensor_index] = dht_dat[2] + ((float)dht_dat[3]/10.0);
		}

		if(write_to_console == 1)
		{
			write_to_stdout(sensor_index);
		}

		if(write_to_file == 1)
		{
			if(relative_humidity[sensor_index] != last_written_relative_humidity[sensor_index]
				|| temperature[sensor_index] != last_written_temperature[sensor_index])
			{
				record_to_file(sensor_index);
			}
		}
	}
	else
	{
		printf( "Data not good for %s, skip\n", names[sensor_index] );
	}
}

int main( int argc, char** argv )
{
	int pin_index = 0;
	int name_index = 0;
	int type_index = 0;

	for(pin_index = 0;pin_index < MAX_PINS; pin_index++)
	{
		pins[pin_index] = -1;
		todays_server_file_syncd[pin_index] = 0;
	}
	pin_index = 0;

	printf( "Raspberry Pi wiringPi DHTxx Temperature reader\n");
	int c;
// TODO: Might be an idea to print out usage and --help?
	while ((c = getopt (argc, argv, "t:s:n:o:h:p:")) != -1)
	{
		switch(c)
		  {
		  // t = Type <DHT22|DHT11>
		  case 't':
		    if(strcmp(optarg, "DHT22")==0)
		    {
			printf("Type is DHT22 at index %d\n", type_index);
			type_is_dht22[type_index++] = 1;
		    }
                    else if(strcmp(optarg, "DHT11")==0)
		    {
			printf("Type is DHT11 at index %d\n", type_index);
			type_is_dht22[type_index++] = 0;
		    }
		    else
		    {
		     	printf("Unknown type %s ignored\n",optarg);
		    }
		  break;
		   // Name the sensor and pin
		   case 'n':
			if(name_index < MAX_PINS)
			{
				printf("Adding Sensor %s at index %d\n",optarg,name_index);
				names[name_index++] = optarg;
			}
		  break;
		case 'p':
			if(pin_index < MAX_PINS)
			{
				int pin = atoi(optarg);
				printf("Adding sensor pin %d at index %d\n",pin, pin_index);
				pins[pin_index++] = pin;
			}
		break;
	 	   // Location of server share
		case 's':
		  server_path = optarg;
		break;
		// h = History - number of days to keep files before deleting.
		case 'h':
		  days_to_keep_old_files = atoi(optarg);
		  printf("Will keep for %d days\n",days_to_keep_old_files);
		break;
		   }
	}
	printf("Active pins:\n");
	int index ;
	for( index = 0; index <MAX_PINS; index++)
	{
		if(pins[index] != -1 && names[index] != NULL)
		{
			printf("Index %d Name %s Pin %d\n",index,names[index],pins[index]);
		}
	}


	if ( wiringPiSetup() == -1 )
	{
		exit( 1 );
	}

	while(1)
	{
		int sensor_index;
		for(sensor_index = 0; sensor_index <MAX_PINS; sensor_index++)
		{
			if(pins[sensor_index] != -1 && names[sensor_index] != NULL)
			{
				read_dht11_dat(sensor_index);
				delay( 1000 * POLLING_PERIOD_SECONDS );
			}
		}
	}

	return(0);
}

